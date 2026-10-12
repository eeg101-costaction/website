#!/usr/bin/env python3
"""Tests for push_to_main.sh, run against real git repositories.

Each test builds a bare "remote" and two clones: `worker` is the sync job, and
`other` is whatever else pushes to main while the job runs (the other sync, a
person, or a second scheduled run). Nothing here touches the network.

Run: python3 scripts/test_push_to_main.py
"""

import os
import shutil
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("push_to_main.sh")
REAL_GIT = shutil.which("git")


def git(cwd, *args, check=True):
    return subprocess.run([REAL_GIT, *args], cwd=cwd, check=check, text=True,
                          capture_output=True,
                          env={**os.environ, "GIT_CONFIG_GLOBAL": "/dev/null", "GIT_CONFIG_SYSTEM": "/dev/null"})


class PushToMain(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix="push-to-main-"))
        self.addCleanup(shutil.rmtree, self.root, ignore_errors=True)
        self.remote = self.root / "remote.git"
        git(self.root, "init", "--bare", "-b", "main", str(self.remote))
        seed = self.root / "seed"
        git(self.root, "clone", str(self.remote), str(seed))
        self.identify(seed)
        (seed / "signatories.yml").write_text("count: 1\n")
        (seed / "catalogue.yml").write_text("items: 10\n")
        (seed / "network.json").write_text("{}\n")
        git(seed, "add", "-A")
        git(seed, "commit", "-m", "seed")
        git(seed, "push", "origin", "HEAD:main")
        self.worker = self.clone("worker")
        self.other = self.clone("other")

    def identify(self, repo):
        git(repo, "config", "user.name", "tester")
        git(repo, "config", "user.email", "tester@example.invalid")

    def clone(self, name):
        path = self.root / name
        git(self.root, "clone", str(self.remote), str(path))
        self.identify(path)
        return path

    def commit(self, repo, filename, text, message):
        (repo / filename).write_text(text)
        git(repo, "add", "-A")
        git(repo, "commit", "-m", message)

    def remote_subjects(self):
        return git(self.remote, "log", "--format=%s", "main").stdout.strip().splitlines()

    def run_script(self, extra_env=None):
        env = {**os.environ, "GIT_CONFIG_GLOBAL": "/dev/null", "GIT_CONFIG_SYSTEM": "/dev/null",
               "RETRY_DELAY": "0", **(extra_env or {})}
        return subprocess.run(["bash", str(SCRIPT)], cwd=self.worker, env=env, text=True,
                              capture_output=True)

    # -- the happy paths --------------------------------------------------

    def test_plain_push_when_main_has_not_moved(self):
        self.commit(self.worker, "signatories.yml", "count: 2\n", "sync")
        r = self.run_script()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.remote_subjects(), ["sync", "seed"])

    def test_the_failure_from_production(self):
        """A second run queued behind the first checked out the pre-push SHA, so by
        the time it pushed, main had the first run's commit and it was rejected."""
        self.commit(self.other, "signatories.yml", "count: 2\n", "first run's sync")
        git(self.other, "push", "origin", "HEAD:main")
        # `worker` is still on the old base, exactly as the queued run was.
        self.commit(self.worker, "catalogue.yml", "items: 11\n", "second run's sync")
        plain = git(self.worker, "push", "origin", "HEAD:main", check=False)
        self.assertNotEqual(plain.returncode, 0, "precondition: a plain push must be rejected")
        self.assertIn("rejected", plain.stderr)

        r = self.run_script()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.remote_subjects(), ["second run's sync", "first run's sync", "seed"],
                         "both commits kept, history stays linear")
        self.assertIn("lost a race", r.stdout)

    def test_a_person_pushing_to_an_unrelated_file(self):
        self.commit(self.other, "README.md", "hello\n", "a person edits the readme")
        git(self.other, "push", "origin", "HEAD:main")
        self.commit(self.worker, "network.json", '{"a": 1}\n', "sync")
        r = self.run_script()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.remote_subjects(), ["sync", "a person edits the readme", "seed"])

    def test_a_different_line_of_the_same_file_rebases_cleanly(self):
        base = "\n".join(f"line {i}" for i in range(1, 21)) + "\n"
        self.commit(self.other, "catalogue.yml", base, "make a long file")
        git(self.other, "push", "origin", "HEAD:main")
        git(self.worker, "pull", "--quiet", "origin", "main")
        self.commit(self.other, "catalogue.yml", base.replace("line 2\n", "line two\n"), "edit near the top")
        git(self.other, "push", "origin", "HEAD:main")
        self.commit(self.worker, "catalogue.yml", base.replace("line 19\n", "line nineteen\n"), "sync")
        r = self.run_script()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        merged = git(self.remote, "show", "main:catalogue.yml").stdout
        self.assertIn("line two", merged)
        self.assertIn("line nineteen", merged)

    # -- standing down ----------------------------------------------------

    def test_a_conflict_stands_down_and_never_overwrites_the_other_writer(self):
        self.commit(self.other, "signatories.yml", "count: 5\n", "fresher data")
        git(self.other, "push", "origin", "HEAD:main")
        self.commit(self.worker, "signatories.yml", "count: 3\n", "stale data")
        r = self.run_script()
        self.assertEqual(r.returncode, 0, "a stand-down is not a failure: " + r.stdout + r.stderr)
        self.assertIn("::warning::", r.stdout)
        self.assertEqual(git(self.remote, "show", "main:signatories.yml").stdout, "count: 5\n")
        self.assertEqual(self.remote_subjects(), ["fresher data", "seed"])
        # ...and it leaves the checkout clean, not stuck mid-rebase.
        self.assertEqual(git(self.worker, "status", "--porcelain").stdout, "")
        self.assertFalse((self.worker / ".git" / "rebase-merge").exists())

    def test_nothing_to_push_when_the_other_writer_made_the_same_change(self):
        self.commit(self.other, "signatories.yml", "count: 2\n", "first run")
        git(self.other, "push", "origin", "HEAD:main")
        self.commit(self.worker, "signatories.yml", "count: 2\n", "identical change")
        r = self.run_script()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.remote_subjects(), ["first run", "seed"], "no duplicate commit pushed")

    # -- failing loudly ---------------------------------------------------

    def test_a_rejection_that_is_not_a_race_fails_at_once(self):
        hook = self.remote / "hooks" / "pre-receive"
        hook.write_text("#!/bin/sh\necho 'protected branch' >&2\nexit 1\n")
        hook.chmod(hook.stat().st_mode | stat.S_IEXEC)
        self.commit(self.worker, "signatories.yml", "count: 2\n", "sync")
        r = self.run_script({"MAX_ATTEMPTS": "5"})
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertIn("not a race", r.stdout)
        self.assertNotIn("attempt 2", r.stdout, "must not burn retries on something that cannot work")
        self.assertIn("protected branch", r.stdout + r.stderr)

    def test_it_gives_up_when_main_never_stops_moving(self):
        """Shim `git` so that every push is preceded by someone else pushing."""
        shim = self.root / "shim"
        shim.mkdir()
        counter = self.root / "counter"
        counter.write_text("0")
        (shim / "git").write_text(f"""#!/bin/sh
if [ "$1" = push ]; then
  n=$(cat {counter}); n=$((n+1)); echo $n > {counter}
  cd {self.other} || exit 1
  echo "$n" > noise.txt
  {REAL_GIT} add -A >/dev/null && {REAL_GIT} commit -qm "noise $n" && {REAL_GIT} pull -q --rebase origin main && {REAL_GIT} push -q origin HEAD:main
  cd - >/dev/null
fi
exec {REAL_GIT} "$@"
""")
        (shim / "git").chmod(0o755)
        self.commit(self.worker, "network.json", '{"a": 1}\n', "sync")
        r = self.run_script({"PATH": f"{shim}:{os.environ['PATH']}", "MAX_ATTEMPTS": "3"})
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertEqual(r.stdout.count("lost a race"), 3, "tried exactly MAX_ATTEMPTS times")
        self.assertIn("still could not push after 3 attempts", r.stdout)


if __name__ == "__main__":
    unittest.main(verbosity=2)
