#!/usr/bin/env bash
# Local smoke test against a running server: ./scripts/smoke.sh [base-url]
# Needs an owner account (OWNER_USER / OWNER_PASS env).
set -u
BASE="${1:-http://127.0.0.1:4399}"
USER="${OWNER_USER:-admin}"
PASS="${OWNER_PASS:-correct-horse-battery}"
JAR="$(mktemp)"
fail=0
check() { # name expected actual
  if [ "$2" = "$3" ]; then echo "  ok   $1 ($3)"; else echo "  FAIL $1 expected $2 got $3"; fail=1; fi
}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "public"
for p in / /learning /research/papers /archive /tags /knowledge /rss.xml /sitemap.xml /robots.txt "/search?q=hello"; do
  check "GET $p" 200 "$(code "$BASE$p")"
done
check "404" 404 "$(code "$BASE/does-not-exist")"
check "owner redirect" 302 "$(code "$BASE/owner")"
check "owner api unauth" 401 "$(code "$BASE/api/owner/posts")"
check "no login link on home" 0 "$(curl -s "$BASE/" | grep -c '/owner')"

echo "auth"
check "login bad origin" 403 "$(code -H 'content-type: application/json' -H 'origin: http://evil.example' -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" "$BASE/api/auth/login")"
check "login wrong pw" 401 "$(code -H 'content-type: application/json' -H "origin: $BASE" -d "{\"username\":\"$USER\",\"password\":\"nope-nope-nope\"}" "$BASE/api/auth/login")"
check "login ok" 200 "$(code -c "$JAR" -H 'content-type: application/json' -H "origin: $BASE" -d "{\"username\":\"$USER\",\"password\":\"$PASS\",\"remember\":true}" "$BASE/api/auth/login")"
check "owner page" 200 "$(code -b "$JAR" "$BASE/owner")"
check "owner api" 200 "$(code -b "$JAR" "$BASE/api/owner/posts")"
check "mutation without csrf" 403 "$(code -b "$JAR" -X POST -H 'content-type: application/json' -H "origin: $BASE" -d '{}' "$BASE/api/owner/stats")"
CSRF="$(curl -s -b "$JAR" "$BASE/owner" | grep -o 'name="csrf-token" content="[^"]*"' | sed 's/.*content="//;s/"$//')"
check "mutation cross-origin" 403 "$(code -b "$JAR" -X POST -H 'content-type: application/json' -H 'origin: http://evil.example' -H "x-csrf-token: $CSRF" -d '{}' "$BASE/api/owner/stats")"
check "mutation with csrf" 200 "$(code -b "$JAR" -X POST -H 'content-type: application/json' -H "origin: $BASE" -H "x-csrf-token: $CSRF" -d '{}' "$BASE/api/owner/stats")"

echo "headers"
H="$(curl -s -D - -o /dev/null "$BASE/")"
check "csp script-src" 1 "$(echo "$H" | grep -ic "content-security-policy:.*script-src")"
check "frame-ancestors" 1 "$(echo "$H" | grep -ic "frame-ancestors 'none'")"
check "nosniff" 1 "$(echo "$H" | grep -ic "x-content-type-options: nosniff")"

rm -f "$JAR"
[ $fail = 0 ] && echo "ALL OK" || { echo "SOME CHECKS FAILED"; exit 1; }
