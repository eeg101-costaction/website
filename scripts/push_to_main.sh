#!/usr/bin/env bash
# Push the commit(s) a data-sync job just made to main, surviving main having moved.
#
# The sync workflows commit generated data files and push them to main. Between
# checking out and pushing, other things can land on main: the other sync, a
# person, or a second scheduled run (GitHub occasionally fires a cron twice a
# few seconds apart, and the queued copy then starts after the first has pushed).
# A plain `git push` is rejected as a non-fast-forward when that happens, and the
# job fails even though nothing is wrong.
#
# This pushes, and if the push loses a race, rebases onto the new tip and tries
# again. It deliberately does NOT retry blindly:
#
#   * A rejection only counts as a race if the remote has commits we lack. If it
#     does not (bad credentials, a protected branch, a network fault) it fails at
#     once with git's own message, rather than retrying something that cannot work.
#   * If the rebase conflicts, somebody else changed the same generated file while
#     we were running, so their copy is at least as fresh as ours. We drop our
#     commit and stand down with a warning; tomorrow's run reconciles. The other
#     writer is never overwritten.
#   * It gives up after MAX_ATTEMPTS, loudly, so a persistent problem still shows.
#
# Expects to run inside a checkout with the commit already made and git's
# user.name / user.email configured (a rebase needs a committer identity).
#
# Environment (defaults suit the workflows; the tests override them):
#   REMOTE=origin  BRANCH=main  MAX_ATTEMPTS=5  RETRY_DELAY=3

set -uo pipefail

REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-main}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-5}"
RETRY_DELAY="${RETRY_DELAY:-3}"

say()  { echo "push_to_main: $*"; }
warn() { echo "::warning::push_to_main: $*"; }
fail() { echo "::error::push_to_main: $*"; exit 1; }

attempt=1
while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  if output=$(git push "$REMOTE" "HEAD:$BRANCH" 2>&1); then
    echo "$output"
    say "pushed (attempt $attempt)."
    exit 0
  fi

  echo "$output"
  git fetch --quiet "$REMOTE" "$BRANCH" || fail "could not fetch $REMOTE/$BRANCH to see why the push was rejected."
  tip=$(git rev-parse FETCH_HEAD)

  # Not a race: the remote has nothing we lack, so the rejection has another cause.
  if git merge-base --is-ancestor "$tip" HEAD; then
    fail "push rejected although $REMOTE/$BRANCH has no commits we lack, so this is not a race (see git's message above)."
  fi

  say "attempt $attempt lost a race: $BRANCH moved to ${tip:0:7}. Rebasing onto it."
  if ! git rebase --quiet "$tip"; then
    git rebase --abort >/dev/null 2>&1 || true
    git reset --quiet --hard "$tip"
    warn "our changes conflict with ${tip:0:7}, which already updated the same files, so theirs is at least as fresh. Nothing was pushed; the next scheduled run will reconcile."
    exit 0
  fi

  # Rebasing can leave nothing to push (the other writer already made our change).
  if git merge-base --is-ancestor HEAD "$tip"; then
    say "the new $BRANCH already contains our change. Nothing to push."
    exit 0
  fi

  sleep $(( RETRY_DELAY * attempt ))
  attempt=$(( attempt + 1 ))
done

fail "still could not push after $MAX_ATTEMPTS attempts because $BRANCH kept moving."
