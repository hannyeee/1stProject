# ADR-002: 상시 운영을 위한 Windows PC 3대의 서버 재배치 및 자원 할당

| 항목 | 내용 |
| --- | --- |
| 상태 | 채택됨 — 서비스 수량·호스트 배치는 사용자 확인 반영 |
| 최초 작성일 | 2026-11-09 |
| 구성 정정 | 2026-11-17, 사용자 설명 기준 |
| 이전 결정 | [ADR-001](001-serverSpec.md) |
| 적용 범위 | Windows 호스트 3대의 서비스별 VM 배치 |

## 1. 변경 배경

개인 Mac을 상시 운영 호스트에서 제외하고 Windows PC 3대로 운영한다.
서로 다른 문서에서 PC 번호와 프록시 종류를 혼동한 기록이 있어, 현재 배치는 번호 대신 역할로 구분한다.
초기 가정은 [ADR-001](001-serverSpec.md)에 보존하며 현재 서버 안내는 [serverSpec.md](../serverSpec.md)를 따른다.

## 2. 현재 배치

| 물리 호스트 | 서비스별 VM | VM 수 |
| --- | --- | ---: |
| API 호스트 | FastAPI 2대, HAProxy 1대, Grafana 1대, Prometheus 1대 | 5 |
| 웹 호스트 | Nginx 2대, HAProxy 1대, Loki 1대 | 4 |
| DB 호스트 | MariaDB 3대, MongoDB 1대, HAProxy 1대 | 5 |
| 합계 | Nginx 2대·FastAPI 2대·MariaDB 3대·MongoDB 1대·HAProxy 3대·모니터링 3대 | 14 |

Grafana와 Prometheus는 FastAPI 2대를 설치한 물리 PC에, Loki는 Nginx 2대를 설치한 물리 PC에 있다.
HAProxy는 각 물리 PC에 1대씩 배치한다. 모니터링 서비스는 같은 물리 PC 안에서 별도 VM으로 운영하는 기록이다.
기존 표의 Nginx 4대·HAProxy 1대는 잘못된 역할 구분이므로 위 수량으로 정정했다.
서버별 IP·담당자는 [networkInfo.md](../networkInfo.md)를 따른다.

## 3. 장비와 VM 할당 기록

기존 장비 기록은 동일 사양 Windows PC 3대, Intel Core i5-1340P, RAM 32GB, 전체 디스크 500GB다.
아래 수치는 기존 문서의 VM 한 대당 할당 기록이며 이번 정리에서 새로 측정한 값은 아니다.

| 호스트 | 서비스 | VM 수 | vCPU | RAM | 가상 디스크 |
| --- | --- | ---: | ---: | ---: | --- |
| API 호스트 | FastAPI | 2 | 4 | 6GB | 25GB |
| API 호스트 | HAProxy | 1 | 기존 기록 없음 | 기존 기록 없음 | 기존 기록 없음 |
| API 호스트 | Grafana·Prometheus | 각각 1 | 기존 기록 없음 | 기존 기록 없음 | 기존 기록 없음 |
| 웹 호스트 | Nginx | 2 | 4 | 6GB | 25GB |
| 웹 호스트 | HAProxy | 1 | 기존 기록 없음 | 기존 기록 없음 | 기존 기록 없음 |
| 웹 호스트 | Loki | 1 | 4 | 10GB | 기존 기록 없음 |
| DB 호스트 | MariaDB | 3 | 2 | 6GB | 30GB |
| DB 호스트 | MongoDB | 1 | 2 | 6GB | 30GB |
| DB 호스트 | HAProxy | 1 | 1 | 2GB | 10GB |

사용자에게 확인한 것은 서비스 수량·물리 동거 관계와 Nginx → HAProxy 179 → FastAPI 연결이다.
위의 세부 자원 기록은 그 확인과 구분하며, 누락된 값을 다른 서비스의 값으로 복사하지 않는다.

## 4. 배치와 할당 근거

웹·API·DB를 물리 호스트별로 구분해 배포와 관리를 단순하게 했다.
API 호스트는 FastAPI와 메트릭·대시보드, 웹 호스트는 Nginx와 로그 저장을 맡는다.
프록시는 호스트마다 하나씩 둔다. 웹 앞단은 181, API 앞단은 179이며 DB 호스트의 프록시는 180이다.
FastAPI가 MariaDB에 접속하는 경로의 구성 결정은 ADR-003과 구분한다.

DB 호스트는 DB VM 4대에 각각 6GB와 HAProxy 2GB를 할당하면 합계 26GB다.
32GB 중 나머지 6GB를 Windows·VMware 등이 사용한다. DB당 8GB로 올리면 합계 34GB가 되어 물리 메모리를 넘는다.
웹 호스트는 Nginx 2대와 Loki의 기록된 RAM만 22GB이며 HAProxy·호스트 사용량도 합산해야 한다.
API 호스트도 FastAPI 2대의 12GB에 HAProxy·Grafana·Prometheus·호스트 사용량을 추가한다.

## 5. 운영 확인과 제약

전체 디스크 500GB에는 Windows·VM 이미지·스냅샷이 함께 저장되므로 실제 여유 공간과 DB·로그 증가량을 관리한다.
초기 할당값만으로 성능이나 보관 기간을 보장하지 않는다.

| 중단된 호스트 | 함께 영향을 받는 서비스 |
| --- | --- |
| API 호스트 | FastAPI 2대, API 앞단 HAProxy, Grafana, Prometheus |
| 웹 호스트 | Nginx 2대, 웹 앞단 HAProxy, Loki |
| DB 호스트 | MariaDB 3대, MongoDB, DB 앞단 HAProxy |

같은 서비스의 VM 여러 대를 같은 물리 PC에 두므로 물리 호스트 중단에는 해당 계층 전체가 영향을 받는다.
HAProxy 3대는 서로 다른 계층의 프록시이며 같은 접속점의 이중화 3대가 아니다.
DB 앞단 구성과 후속 장애 전환 검증 범위는 [ADR-003](003-dbConfiguration.md)을 따른다.
