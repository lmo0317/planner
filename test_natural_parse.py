import json
import sys
import time

import requests


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


URL = sys.argv[1] if len(sys.argv) > 1 else "http://192.168.219.112:19000/api/todos/parse-natural-language"
BASE_DATE = "2026-07-18T10:00:00+09:00"


CASES = [
    {
        "name": "내일 단일 일정",
        "text": "내일 오후 3시에 강남 치과 예약 추가해줘",
        "expected": [("2026-07-19", "15:00")],
    },
    {
        "name": "복수 일정",
        "text": "다음 주 화요일 오전 10시 팀 회의하고 다음 주 수요일 오후 2시에는 병원 예약",
        "expected": [("2026-07-21", "10:00"), ("2026-07-22", "14:00")],
    },
    {
        "name": "명시 날짜",
        "text": "7월 25일 오후 7시에 가족 저녁 식사",
        "expected": [("2026-07-25", "19:00")],
    },
    {
        "name": "시간 누락 종일 일정",
        "text": "다음 주 월요일에 프로젝트 회의 추가해줘",
        "expected": [("2026-07-20", "00:00")],
        "all_day": True,
    },
]


def slots(events):
    return sorted((event["startDate"][:10], event["startDate"][11:16]) for event in events)


def main():
    failures = []
    for case in CASES:
        started = time.time()
        response = requests.post(
            URL,
            json={"text": case["text"], "baseDate": BASE_DATE},
            timeout=120,
        )
        response.raise_for_status()
        result = response.json()
        actual = slots(result.get("events", []))
        all_day_ok = not case.get("all_day") or all(event.get("allDay") is True for event in result.get("events", []))
        passed = actual == sorted(case["expected"]) and all_day_ok
        print(f"[{'PASS' if passed else 'FAIL'}] {case['name']} ({time.time() - started:.1f}s)")
        if not passed:
            print(json.dumps(result, ensure_ascii=False, indent=2))
            failures.append(case["name"])
    if failures:
        print(f"FAILED: {', '.join(failures)}")
        return 1
    print("All natural-language schedule cases passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
