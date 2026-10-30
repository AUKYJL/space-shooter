#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"
SERVICES=(colima fe be postgres)

COLOR_RESET=$'\033[0m'
COLOR_DIM=$'\033[2m'
COLOR_GREEN=$'\033[32m'
COLOR_RED=$'\033[31m'
COLOR_CYAN=$'\033[36m'
COLOR_BOLD=$'\033[1m'

selected_idx=0
last_error_colima=""
last_error_fe=""
last_error_be=""
last_error_postgres=""

error_key() {
  local svc="$1"
  # keep it simple: only known service ids from SERVICES list
  echo "last_error_${svc}"
}

error_set() {
  local svc="$1"
  local msg="$2"
  local key
  key="$(error_key "$svc")"
  printf -v "$key" "%s" "$msg"
}

error_get() {
  local svc="$1"
  local key
  key="$(error_key "$svc")"
  printf '%s' "${!key-}"
}

cleanup() {
  stty echo icanon 2>/dev/null || true
  # Leave alternate screen buffer (if entered)
  printf '\033[?1049l\033[?25h%s' "${COLOR_RESET}"
}
trap cleanup EXIT INT TERM

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

need_cmd docker

has_colima() {
  command -v colima >/dev/null 2>&1
}

enter_alt_screen() {
  # Use alternate screen buffer + hide cursor to avoid scroll/jitter.
  printf '\033[?1049h\033[H\033[2J\033[?25l'
}

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

colima_state() {
  if ! has_colima; then
    echo "missing"
    return 0
  fi

  if colima status >/dev/null 2>&1; then
    echo "active"
    return 0
  fi

  # colima returns non-zero when not running
  echo "inactive"
}

service_state() {
  local svc="$1"

  if [[ "$svc" == "colima" ]]; then
    colima_state
    return 0
  fi

  local state
  state="$(compose ps --format json "$svc" 2>/dev/null | sed -n 's/.*"State":"\\([^"]*\\)".*/\\1/p' | head -n1 || true)"
  if [[ -z "${state:-}" ]]; then
    echo "inactive"
    return 0
  fi
  case "$state" in
    running) echo "active" ;;
    exited|dead) echo "error" ;;
    *) echo "$state" ;;
  esac
}

print_logs() {
  local svc="$1"
  # Show logs in the normal screen buffer (outside TUI).
  printf '\033[?1049l\033[?25h'
  echo
  echo "---- logs: $svc (tail 200) ----"

  if [[ "$svc" == "colima" ]]; then
    if has_colima; then
      colima status || true
    else
      echo "colima: not installed"
    fi
  else
    compose logs --no-color --tail=200 "$svc" || true
  fi
  echo "---- end logs: $svc ----"
  echo

  echo "Press any key to return..."
  IFS= read -rsn1 _ || true
  enter_alt_screen
}

toggle_service() {
  local svc="$1"
  local state
  state="$(service_state "$svc")"
  error_set "$svc" ""

  if [[ "$svc" == "colima" ]]; then
    if [[ "$state" == "missing" ]]; then
      error_set "$svc" "colima not installed"
      return 1
    fi

    if [[ "$state" == "active" ]]; then
      if ! colima stop; then
        error_set "$svc" "stop failed"
        print_logs "$svc"
        return 1
      fi
      return 0
    fi

    if ! colima start; then
      error_set "$svc" "start failed"
      print_logs "$svc"
      return 1
    fi
    return 0
  fi

  if [[ "$state" == "active" ]]; then
    if ! compose stop "$svc" >/dev/null 2>&1; then
      error_set "$svc" "stop failed"
      print_logs "$svc"
      return 1
    fi
    return 0
  fi

  if ! compose up -d "$svc"; then
    error_set "$svc" "start failed"
    print_logs "$svc"
    return 1
  fi
}

render() {
  # Clear screen and go "home" without tput to reduce flicker.
  printf '\033[2J\033[H'

  printf '%s%sSpaceShooter Docker dev menu%s\n' "${COLOR_BOLD}" "${COLOR_CYAN}" "${COLOR_RESET}"
  printf '%sCompose: %s%s\n\n' "${COLOR_DIM}" "$COMPOSE_FILE" "${COLOR_RESET}"

  for i in "${!SERVICES[@]}"; do
    local svc="${SERVICES[$i]}"
    local state
    state="$(service_state "$svc")"

    local cursor="  "
    if [[ "$i" -eq "$selected_idx" ]]; then
      cursor="> "
    fi

    local badge=""
    if [[ "$state" == "active" ]]; then
      badge="${COLOR_GREEN}active${COLOR_RESET}"
    elif [[ "$state" == "missing" ]]; then
      badge="${COLOR_DIM}missing${COLOR_RESET}"
    elif [[ "$state" == "error" ]]; then
      badge="${COLOR_RED}error${COLOR_RESET}"
    elif [[ "$state" == "inactive" ]]; then
      badge="${COLOR_DIM}inactive${COLOR_RESET}"
    else
      badge="${COLOR_DIM}${state}${COLOR_RESET}"
    fi

    printf '%s%-10s [%b]' "$cursor" "$svc" "$badge"

    svc_error="$(error_get "$svc")"
    if [[ -n "${svc_error:-}" ]]; then
      printf '  %s(%s)%s' "${COLOR_RED}" "${svc_error}" "${COLOR_RESET}"
    fi
    printf '\n'
  done

  printf '\n%sKeys:%s ↑/↓ move, Enter toggle, q quit\n' "${COLOR_DIM}" "${COLOR_RESET}"
}

read_key() {
  local k1 k2 k3
  IFS= read -rsn1 k1 || return 1
  if [[ "$k1" == $'\033' ]]; then
    IFS= read -rsn1 k2 || true
    IFS= read -rsn1 k3 || true
    echo "${k1}${k2}${k3}"
    return 0
  fi
  echo "$k1"
}

stty -echo -icanon time 0 min 1
enter_alt_screen

while true; do
  render
  key="$(read_key)" || break
  case "$key" in
    $'\033[A') # up
      ((selected_idx--)) || true
      if ((selected_idx < 0)); then selected_idx=$((${#SERVICES[@]} - 1)); fi
      ;;
    $'\033[B') # down
      ((selected_idx++)) || true
      if ((selected_idx >= ${#SERVICES[@]})); then selected_idx=0; fi
      ;;
    "") # Enter (some terminals)
      svc="${SERVICES[$selected_idx]}"
      toggle_service "$svc" || true
      ;;
    $'\n'|$'\r') # Enter
      svc="${SERVICES[$selected_idx]}"
      toggle_service "$svc" || true
      ;;
    q|Q)
      break
      ;;
  esac
done
