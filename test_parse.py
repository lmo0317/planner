import argparse
import json
import os
import sys
import time

import requests


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


DEFAULT_URL = "http://192.168.219.112:19000/api/todos/parse-chat"
BASE_DATE = "2026-07-17T11:05:00+09:00"


REGRESSION_CASES = [
    {
        "name": "메시지 시각 기준 내일",
        "chat": (
            "2026년 7월 17일 오전 10:00, 철수 : 내일 오후 3시에 강남역에서 보자\n"
            "2026년 7월 17일 오전 10:01, 영희 : 좋아"
        ),
        "expected": [("2026-07-18", "15:00")],
    },
    {
        "name": "흔한 식사 표현",
        "chat": (
            "2026년 7월 17일 오전 10:00, 철수 : 내일 12시에 점심 먹자\n"
            "2026년 7월 17일 오전 10:01, 영희 : 그래 좋아"
        ),
        "expected": [("2026-07-18", "12:00")],
    },
    {
        "name": "미확정 제안 제외",
        "chat": (
            "2026년 7월 17일 오전 10:00, 철수 : 내일 오후 3시에 만날까?\n"
            "2026년 7월 17일 오전 10:01, 영희 : 아직 모르겠어"
        ),
        "expected": [],
    },
    {
        "name": "취소 일정 제외",
        "chat": (
            "2026년 7월 17일 오전 10:00, 철수 : 내일 오후 3시에 병원 예약했어\n"
            "2026년 7월 17일 오전 11:00, 철수 : 내일 병원 예약 취소했어"
        ),
        "expected": [],
    },
    {
        "name": "시간 변경 시 원래 날짜 유지",
        "chat": (
            "2026년 7월 17일 오전 10:00, 철수 : 내일 오후 3시에 회의하자\n"
            "2026년 7월 17일 오전 10:01, 영희 : 좋아\n"
            "2026년 7월 17일 오전 11:00, 철수 : 회의는 오후 5시로 바뀌었어\n"
            "2026년 7월 17일 오전 11:01, 영희 : 알겠어"
        ),
        "expected": [("2026-07-18", "17:00")],
    },
    {
        "name": "복수 요일 일정",
        "chat": (
            "2026년 7월 17일 오전 10:00, 철수 : 이번 주 토요일 오전 11시에 병원 예약했어\n"
            "2026년 7월 17일 오전 10:01, 영희 : 알겠어\n"
            "2026년 7월 17일 오전 10:02, 철수 : 다음 주 수요일 오후 2시에 업무 미팅도 확정됐어"
        ),
        "expected": [("2026-07-18", "11:00"), ("2026-07-22", "14:00")],
    },
    {
        "name": "과거 대화의 당시 확정 일정",
        "chat": (
            "2026년 7월 10일 오전 10:00, 철수 : 내일 오후 3시에 회의하자\n"
            "2026년 7월 10일 오전 10:01, 영희 : 좋아"
        ),
        "expected": [("2026-07-11", "15:00")],
    },
    {
        "name": "축약 요일 계산",
        "chat": (
            "2026년 4월 15일 오후 5:43, 철수 : 토 저녁 7시에 쭈꾸미 먹으러 갈래?\n"
            "2026년 4월 15일 오후 5:44, 영희 : 그래 좋아"
        ),
        "expected": [("2026-04-18", "19:00")],
    },
]


def parse_slots(events):
    return sorted((event["startDate"][:10], event["startDate"][11:16]) for event in events)


def request_events(url, chat, base_date, timeout):
    response = requests.post(
        url,
        json={"chatText": chat, "baseDate": base_date},
        timeout=timeout,
    )
    response.raise_for_status()
    return response.json(), response.headers.get("X-Parse-Warnings")


def run_regressions(url):
    failures = []
    for case in REGRESSION_CASES:
        started = time.time()
        events, warnings = request_events(url, case["chat"], BASE_DATE, 120)
        actual = parse_slots(events)
        expected = sorted(case["expected"])
        passed = actual == expected and not warnings
        status = "PASS" if passed else "FAIL"
        print(f"[{status}] {case['name']} ({time.time() - started:.1f}s)")
        if not passed:
            print(f"  expected={expected}")
            print(f"  actual={actual}, warnings={warnings}")
            print(json.dumps(events, ensure_ascii=False, indent=2))
            failures.append(case["name"])
    return failures


def run_sample(url, sample_path):
    if not os.path.exists(sample_path):
        raise FileNotFoundError(sample_path)
    with open(sample_path, "r", encoding="utf-8") as sample_file:
        chat = sample_file.read()
    started = time.time()
    events, warnings = request_events(url, chat, BASE_DATE, 300)
    print(
        f"[SAMPLE] {len(chat):,} chars -> {len(events)} events "
        f"({time.time() - started:.1f}s), warnings={warnings or 0}"
    )
    print(json.dumps(events, ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser(description="KakaoTalk schedule parser regression harness")
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--sample", help="Optional KakaoTalk export text file")
    args = parser.parse_args()

    failures = run_regressions(args.url)
    if args.sample:
        run_sample(args.url, args.sample)
    if failures:
        print(f"\nFAILED: {', '.join(failures)}")
        return 1
    print("\nAll regression cases passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
