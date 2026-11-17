# 사용자 행동 생성·부하 테스트 안내

브라우저 행동 자동화와 API 부하 테스트의 실행 방법을 정리한다.
현재 API 부하는 `users/loadtest`를 사용하며 구형 실행기와 복구 도구는 과거 기록의 코드 확인용으로 보관한다.

| 목적 | 실행 도구 | 안내·결과 |
| --- | --- | --- |
| 실제 화면 조작, 최초 가입·추가 방문 | `users/playwright/run.py`, `runPeriods.py` | 아래 브라우저 실행 안내 |
| 이후 단계별 API 부하·정합성·지속·스트레스 테스트 | `users/loadtest/run_load.py` | [실행기 안내](loadTestGuide.md), [11월 8일 최종 전체 실행](loadTestResult10.md) |

구형 300명 API 실행기 `users/previous/loadTest.py`와 전용 테스트, 최초 실행용 `audit.py`·`recover.py`, 일회성 `users/previous/extend_personas.py`는 보관용이다.
과거 실행 조건·결과는 문서에 보존하며 현재 실행 명령은 아래와 [loadTestGuide.md](loadTestGuide.md)를 따른다.

| 폴더 | 용도 |
| --- | --- |
| `users/playwright/` | 브라우저 행동 자동화와 검증 |
| `users/loadtest/` | 현재 API 부하 테스트와 검증·리포트 |
| `users/previous/` | 구형 300명 API 실행기·전용 테스트, 과거 복구·일회성 확장 도구 |

과거 실행기 소스는 `python -m users.previous.loadTest --help`로 옵션을 확인할 수 있다.
이동한 복구 도구도 원래 `users/playwright/artifacts/` 기록을 읽으며 실행 ID와 기록 저장 위치는 변경하지 않았다.
구형 실행기가 새로 만드는 요약 보고서는 실행별 `artifacts/<run-id>/report.md`에 저장한다. `docs`의 회차별 결과 문서를 덮어쓰지 않는다.

## 현재 상태와 저장 위치

- `../users/personas.json`에는 기존 100명을 보존한 총 300명의 프로필이 있다.
- 원본 100명 프로필은 `../users/personas.v100.json`에도 보존되어 있다.
- `load-20261106-prepare`는 11월 6일의 기존 실행으로 `mixed-200`에서 중단됐다.
  이후 실행까지 중단 상태라는 뜻은 아니다.
- 이후 실행기의 `loadtest-20261108-claude-full4`는 11월 8일 21:47~23:22 KST에
  조회·혼합·집중·정합성·100 VU 30분 지속 부하를 포함한 13개 단계를 모두 통과했다.
  총 184,170요청, 5xx 0건, 신규 쓰기 94,400건(MariaDB 46,778 + MongoDB 47,622)으로 보고됐다.
  정합성 시험의 예상 충돌 409 응답은 실패와 구분한다. [상세 결과](loadTestResult10.md)
- `full4`는 기존 실행의 100개 계정을 재사용했다. 현재 프로필 300명, 실행 계정 100명,
  가상 사용자 수(VU)는 서로 다른 값이다. `run_load.py`의 신규 실행 기본 계정 범위는 프로필 101~200번이다.
- 신규 행동 로그 저장 위치는 MongoDB `tikit.events`다. `event` 단수가 아니다.
- 최초 100명 및 추가 방문의 과거 행동 로그는 `tikit.simulation`에 보존한다.
  신규 저장 위치 변경은 기존 데이터의 이동·삭제를 뜻하지 않는다.
- 회원·찜·예매·모의 결제·업무 이벤트는 MariaDB에 있다.
  MongoDB 컬렉션을 지워도 회원이 지워지지는 않지만 과거 행동 분석 근거가 사라진다.

| 용도 | 저장소·기록 | 관리 원칙 |
| --- | --- | --- |
| 현재 API 부하 및 신규 브라우저 행동 로그 | MongoDB `tikit.events` | 합성 표시와 실행 ID로 실제 사용자 로그와 구분 |
| 과거 최초 100명·기간별 방문 로그 | MongoDB `tikit.simulation` | 보존. 기존 실행 검증은 저장된 컬렉션을 읽음 |
| 회원·찜·예매·모의 결제·업무 이벤트 | MariaDB | 기존 계정·거래 보존 |
| 상태·계정 매핑·입력 스냅샷·검증·집계 | `artifacts/<run-id>/` | 재개와 검증에 필요하므로 보존 |

현재 `loadtest/run_load.py`의 DB 대조는 실행 상태의 `mongo_collection`을 사용하고, 없으면 `events`다.
실제 수집 API가 저장하는 컬렉션과 대조 대상이 같아야 한다.
브라우저 전용 서버 `../users/playwright/serve.py`는 신규 쓰기를 `events`로 지정한다.
`simulationApp.py`라는 파일명과 `/simulation-check` 경로는 자동화 서버의 식별용으로
유지하며, 저장 컬렉션은 `events`다.

과거 `simulation` 실행 ID를 신규 `events` 실행에 재사용하지 않는다.
브라우저 실행기는 컬렉션이 바뀐 실행의 재개를 거절한다. 새 실행 ID를 사용하고,
기존 계정을 다시 가입시키지 않도록 최초 가입 실행과 기존 계정 추가 방문을 구분한다.

## 결과 문서 선택

| 시점·목적 | 보고서 |
| --- | --- |
| 11월 6일 기존 실행 | [300명 프로필 기반 실행](loadTestResult02.md), [후속 실행기 최초 부하](loadTestResult01.md) |
| 11월 7일 전체 재실행·동시성 수정 | [재실행](loadTestResult05.md), [데드락 원인·재시도 확인](loadTestResult06.md), [full3·지속 부하](loadTestResult07.md) |
| 스트레스·DB 집중 관측 | [스트레스 결과](loadTestResult03.md), [50 VU DB 관측](loadTestResult04.md) |
| 11월 8일 인덱스·트랜잭션 개선 | [인덱스 전후 조회](loadTestResult08.md), [반복 실행·정합성 재검증](loadTestResult09.md) |
| **11월 8일 마지막 전체 실행** | **[full4 — 13단계 통과](loadTestResult10.md)** |

`full4`의 적용 조건은 데드락 재시도, 응답 전 트랜잭션 종료, `events(type, performance_id)` 인덱스다.
이는 보고서의 당시 배포 상태이며 이번 문서 갱신에서 서버를 새로 확인한 결과가 아니다.
데드락 원인, 일부 순간 지연, MariaDB exporter 미측정 등 남은 항목도 보고서에서 함께 확인한다.

## 파일 역할

| 파일 | 역할 |
| --- | --- |
| `../users/generatePersonas.py` | 프로필 생성·검증, 기존 프로필을 보존하는 `expand_personas()` |
| `../users/personas.json` | 300명 프로필. 프로필 존재와 실제 서비스 계정 존재는 별개 |
| `../users/testGeneratePersonas.py`, `../users/testExpandPersonas.py` | 이름·재현성·다양성·기존 100명 보존 검사 |
| `../users/loadtest/run_load.py` | 이후 API 실행기. `init`·`accounts`·`run`, 계정 재사용·단계별 부하 |
| `../users/loadtest/budget.py`, `infra.py` | 공유 쓰기 예산, DB 대조, 환경 설정·지표 수집 |
| `../users/loadtest/verify_load.py` | 실행별 DB 정합성 검증, `verification.json` 생성 |
| `../users/loadtest/report.py`, `stress_report.py` | 기록에서 결과 표·스트레스 분석 생성 |
| `../users/loadtest/db_snapshot.py` | DB 읽기 스냅샷과 전후 비교, `db_delta.md` 생성 |
| `../users/loadtest/precheck.postman_collection.json` | 읽기 전용 Postman 사전 확인 |
| `../users/loadtest/requirements.txt` | 이후 API 실행기의 별도 의존성 |
| `../users/playwright/run.py` | 브라우저로 최초 가입·로그인·조회·찜·예매 |
| `../users/playwright/runPeriods.py` | 기존 100명 계정으로 추가 방문 생성. 신규 가입 없음 |
| `../users/playwright/serve.py`, `simulationApp.py` | 자동화 전용 backend 8001/frontend 5174 및 접근 키 검사 |
| `../users/playwright/scenarios.py` | 기본 행동 계획·합성 표시·입력 스냅샷·재개 조건 |
| `../users/playwright/periods.py` | 가상 날짜·방문 일정·일/주/월 집계 |
| `../users/playwright/safety.py` | 실패 중단·비밀값 가림·저장·서버 식별·과거 컬렉션 선택 |
| `../users/playwright/transport.py` | 브라우저가 닫히기 전 행동 로그 전송 완료 확인 |
| `../users/playwright/verify.py`, `verifyPeriods.py` | 실제 DB와 실행 증거 대조·집계 출력 |
| `../users/playwright/testScenarios.py`, `testPeriods.py`, `testSafety.py`, `testTransport.py` | 브라우저 행동 규칙·기간 집계·보호 동작·전송 검사 |
| `../backend/requirements.txt` | backend·Playwright 의존성 |

현재 API 단계는 users/loadtest/run_load.py의 main_run()과 RAMP를 기준으로 한다.

## 이후 API 부하 실행기 (`users/loadtest`)

11월 7~8일 후속 테스트에 사용한 도구다. 아래는 실행 방법이며 명령을 실행하면 실제 서비스에 접근한다.
`run_load.py`의 대상은 코드의 `BASE_URL`이다. DB 정보는 `backend/.env` 또는
`DATABASE_URL`, `MONGODB_URL`, `MONGODB_DB` 환경 변수에서 읽고,
Prometheus 주소는 `LOADTEST_PROMETHEUS_URL`로 바꿀 수 있다.

```powershell
python -m venv users/loadtest/.venv
users/loadtest/.venv/Scripts/python.exe -m pip install -r users/loadtest/requirements.txt
$loadPython = 'users/loadtest/.venv/Scripts/python.exe'
$loadRunId = 'loadtest-' + (Get-Date -Format 'yyyyMMdd-HHmmss')

postman collection run users/loadtest/precheck.postman_collection.json
& $loadPython users/loadtest/run_load.py init --run-id $loadRunId
```

일반 `init`는 로컬 실행 상태만 만들며 계정을 가입시키지 않는다. 이후 `accounts`는 필요한 계정을 생성하고,
`run`은 실제 API 부하를 보낸다. `--execute` 옵션은 없다.

```powershell
& $loadPython users/loadtest/run_load.py accounts --run-id $loadRunId
& $loadPython users/loadtest/run_load.py run --run-id $loadRunId
& $loadPython users/loadtest/verify_load.py --run-id $loadRunId
& $loadPython users/loadtest/report.py --run-id $loadRunId
```

이미 사용한 계정으로 새 측정을 할 때는 새 실행 ID와 원본 실행의 `state.json`을 사용한다.
`--reuse-accounts-from`을 붙인 `init`는 DB에서 계정과 기존 데이터 기준선을 읽고 가입은 하지 않는다.
원본 계정 상태 파일이 없는 경우 기존 계정을 임의로 재가입시키지 않는다.

```powershell
$sourceRunId = 'loadtest-20261106-claude'
& $loadPython users/loadtest/run_load.py init --run-id $loadRunId --reuse-accounts-from $sourceRunId
# 계정 재사용 실행은 accounts를 생략
& $loadPython users/loadtest/run_load.py run --run-id $loadRunId
```

위 재사용 예시는 앞의 일반 `init`와 택일한다. 같은 실행 ID로 다시 초기화할 수 없다.

| 항목 | 동작 |
| --- | --- |
| 기본 실행 | `precheck` → `read` → `mixed` → `spike_city` → `spike_baseball` → `consistency` → `sustained` |
| 조회·혼합 단계 | 기본 10·25·50·100 VU. 최대 통과 혼합 VU를 기준으로 집중·지속 부하 구성 |
| 범위 지정 | `--phases read` 등. 조회·혼합 VU는 `--read-vus`, `--mixed-vus`로 지정 |
| 스트레스 | 별도 `--phases stress`, 곡선은 `--stress`, 혼합 비율은 `--stress-mix` |
| 재실행 | 같은 실행 ID의 완료된 phase는 건너뜀. 다시 측정할 phase는 `--redo`로 명시 |
| 중단 | 실행 폴더에 `STOP` 파일 생성. 예산·지연·오류·서버 상태에 따른 자동 중단도 있음 |
| 결과 | DB 검증은 `verification.json`, 표 생성은 `report_tables.md`, 스트레스 분석은 `stress_report.md` |

**Postman의 읽기 전용 사전 확인과 `run`의 `precheck`는 다르다.** 후자는 혼합 시나리오로 실제 예매·로그를 생성한다.
`verify_load.py`는 DB를 읽어 검증하고 로컬 보고서를 저장한다. `report.py`는 저장된 실행 기록에서 표를 만든다.
전체·MongoDB 쓰기 예산은 각각 100,000·50,000건이며 자세한 조건은 [실행기 안내](loadTestGuide.md)를 따른다.

## 브라우저 도구 설치·사용

최초 계정 생성·추가 방문을 재현할 때 사용한다. 브라우저 자동화는
`backend/requirements.txt`를 사용한다. `users/loadtest`의 별도 의존성과 혼동하지 않는다.
Chromium은 브라우저 도구를 사용할 때만 설치하며 API 부하에는 필요하지 않다.

```powershell
python -m pip install -r backend/requirements.txt
python -m playwright install chromium
```

전용 서버는 backend 의존성이 설치된 Python과 frontend 의존성을 사용한다.
`serve.py`의 기본 backend 경로는 Windows의 `.venv/Scripts/python.exe`다.
다른 환경은 `--backend-python`, `--node-executable`로 설치된 런타임을 지정한다.

```powershell
python users/playwright/serve.py --run-id example-new-events-run
```

계획 확인은 서비스에 행동을 보내지 않는다. 최초 가입 도구는 기존 100명 캠페인용이다.
이미 가입된 100명을 다시 만들기 위해 실행하지 않는다.

```powershell
python users/playwright/run.py --run-id example-new-events-run --plan-only
```

`../users/playwright/runPeriods.py`는 원본 100명 실행의 계정 상태와 `profiles-input.json`을 재사용한다.
새 실행 ID와 `--source-run`을 지정하고, 계획 → `verifyPeriods.py --baseline` →
전용 서버 → `--pilot` → 검증 → 전체 실행 순서로 사용한다.
인원은 100명으로 제한되며 현재 300명 JSON으로 원본 실행 입력을 덮어쓰지 않는다.
최초 실행용 `users/previous/audit.py`·`recover.py`는 과거 복구 과정을 확인할 수 있도록 보관한다. 기간별 실행의
`verifyPeriods.py --audit-interrupted` 등은 별도 기능으로 유지한다.

`../users/playwright/verify.py`와 `verifyPeriods.py`는 실행 상태의 `fingerprint.collection`을 읽는다.
따라서 과거 실행은 `simulation`, 신규 실행은 `events`에서 검증한다.
검증 보고서·CSV는 로컬에 저장되지만 DB 데이터를 변경하지 않는다.
과거 검증의 파일 해시 검사는 당시 소스 보존까지 검사하므로 이번 정리 뒤에는
파일 변경을 보고할 수 있다. 이를 DB 데이터 손실로 해석하거나 과거 기준선을 덮어쓰지 않는다.

## 보존할 실행 기록과 정리 가능한 폴더

| 경로 | 의미·정리 기준 |
| --- | --- |
| 가상환경 | 브라우저는 backend 의존성, API 부하는 `users/loadtest/.venv` 사용 |
| `__pycache__/`, 상위 폴더의 `__pycache__/` | Python 캐시. 삭제해도 실행 시 재생성 |
| `../users/playwright/artifacts/persona-20261106` | 최초 100명 가입·행동·계정 매핑·검증 |
| `../users/playwright/artifacts/persona-periods-20261106` | 기존 100명 추가 방문·가상 기간·집계·검증 |
| `../users/playwright/artifacts/load-20261106-preflight` | API 부하 사전 점검 기록 |
| `../users/playwright/artifacts/load-20261106-prepare` | 실제 API 부하 상태·공유 예산·중단·재개·측정 기록 |
| `../users/playwright/artifacts/loadtest-<run-id>/` | 이후 API 실행기의 상태·예산·요청·서버 관측·정합성 결과 |
| `../users/playwright/artifacts/baseline.json`, `documentation_consolidation.json` | 기존 파일 보존 기준·문서 통합 기록 |

`artifacts`는 통째로 삭제하지 않는다. `state.json`에는 계정 ID와 테스트 비밀번호,
`server.json`에는 접근 키가 있으므로 Git 커밋·공유 대상에서 제외한다.
`profiles-input.json`은 실행 당시 프로필, `plan.json`은 행동 계획,
`events.jsonl`·`attempts.jsonl`은 전송 증거다.
`period-baseline.json`은 기존 데이터·파일 보존 기준이고,
감사·복구 기록은 중단 시 실제로 남은 데이터와 체크포인트를 연결한다.
검증 JSON·집계 CSV·실행 로그도 실행 ID별로 보존한다.

이후 실행기는 같은 `artifacts` 하위에 `requests.csv`, `timeline.jsonl`, `prom.jsonl`,
`events_sent.jsonl`, `reservations.jsonl`, `progress.jsonl` 등을 저장한다.
`db_status.jsonl`은 직접 수집한 DB 상태, `db_before.json`·`db_after.json`·`db_delta.md`는
`db_snapshot.py`로 만든 전후 관측 기록이다. `verification.json`과 `report_tables.md`는 별도 검증·집계 명령의 결과다.
원시 기록은 Git 제외 대상이므로, 다른 환경에 없다면 원본 실행 환경에서 받아야 검증·재개할 수 있다.

## 과거 브라우저 실행 결과

아래는 `simulation`을 사용하던 2026-11-06 실행의 기록이다.
신규 `events` 부하 결과와 합쳐서 한 번의 실행처럼 해석하지 않는다.

| 항목 | 최초 `persona-20261106` | 추가 `persona-periods-20261106` |
| --- | ---: | ---: |
| 계정 | 최초 100명 | 같은 100명, 신규 가입 0명 |
| 완료 방문 | 202회 | 1,000회, 사용자별 2~23회 |
| 검증된 공연 조회 | 399건 | 2,018건 |
| MariaDB 찜 증가 | 140건 | 642건 |
| 예매 | 57건 | 297건 |
| 모의 결제 완료 | 49건 | 242건 |
| 결제 대기/이탈 | 8건 | 55건 |
| MongoDB 행동 로그 | 2,404건 | 9,709건 |
| 해당 실행의 `events` 유입 | 0건 | 0건 |

최초 실행은 전송 수정 전 가입 로그 1건·찜 추가 로그 1건이 누락된 이력을 보존했다.
실제 가입 100명에 `sign_up` 99건, 찜 140건에 `favorite_add` 139건이다.
중단·재시도 때문에 MariaDB 조회는 405건으로, 완료 방문의 MongoDB 조회 399건과 다르다.
예매·결제를 재생성하거나 과거 로그를 소급 생성해 건수를 맞추지 않았다.

추가 방문은 2026-11-06 17:17:49 KST에 최종 DB 대조를 통과했다.
중단 당시 MariaDB에만 남은 찜 1건·조회 1건을 보존했으므로
찜 추가 로그는 641건, MariaDB 조회 증가 2,019건이다.
복구 로그인 포함 로그인은 1,001건이며 고유 방문은 1,000회다.
기존 57건의 예매·결제와 원본 계정 상태를 보존하고, 새 결제 금액·로그를 대조했다.

추가 방문의 가상 분석 기간은 2026-10-08~2026-11-06의 30일이다.
`occurred_at`·`received_at`은 실제 시각이고, `props.simulation_at`,
`simulation_at_kst`, `simulation_date`, `simulation_time_is_fictional`은 가상 시간 필드다.
이 필드명의 `simulation`은 컬렉션 이름과 별개이며 변경하지 않는다.
월별 CSV는 30일 창의 부분 월 집계이므로 완전한 두 달 비교에 쓰지 않는다.
`daily.csv`, `weekly.csv`, `monthly.csv`, `analytics.json`, `daily-query.json`,
`verification-periods.json`은 해당 실행 폴더에서 확인한다.

## 로컬 검증

실제 서비스 부하를 보내지 않는 테스트다. 브라우저 전송 검사에는 설치된 Chromium,
브라우저 검사에는 backend 의존성이 필요하다. `../backend/requirements.txt`로 설치한
공통 환경에서 실행한다. 테스트 파일은 camelCase(`testScenarios.py` 등)이므로
unittest 탐색 패턴은 `test*.py`를 사용한다.

```powershell
python -m unittest discover -s users -p "test*.py"
python -m unittest discover -s users/playwright -p "test*.py"
```

이후 API 실행기의 예산·관측·스트레스 곡선 검사는 별도 환경에서 실행한다. 부하 실행 명령이 아니다.

```powershell
users/loadtest/.venv/Scripts/python.exe -m pytest users/loadtest/test_budget.py users/loadtest/test_monitor.py users/loadtest/test_stress.py
```

프로필 생성기·스키마 설명은 [프로필 설계](personaDataDesign.md),
행동 이벤트 정의는 [이벤트 추적](eventTracking.md)을 참고한다.
