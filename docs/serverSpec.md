# 서버 구성과 자원 확인 기준

이 문서는 구성 설명을 정리한 것이며 실서버 설정을 변경하거나 성능을 새로 측정한 결과가 아니다.
IP별 역할은 [networkInfo.md](networkInfo.md), 배치·기존 자원 기록은 [ADR-002](adr/002-windowsServerAllocation.md),
DB 접속 구성은 [ADR-003](adr/003-dbConfiguration.md)를 따른다.

## 서버별 역할

| 역할 | 서버 | 수량 |
| --- | --- | ---: |
| MariaDB | 192.168.0.171~173 | 3 |
| MongoDB | 192.168.0.174 | 1 |
| FastAPI | 192.168.0.175·176 | 2 |
| Nginx | 192.168.0.177·178 | 2 |
| HAProxy | 192.168.0.179~181 | 3 |
| Prometheus | 192.168.0.187 | 1 |
| Grafana | 192.168.0.188 | 1 |
| Loki | 192.168.0.189 | 1 |

183·184·186은 삭제된 주소이며 182·185·190은 네트워크 표에 역할이 지정돼 있지 않다.

## 물리 호스트 배치

문서마다 달랐던 PC 번호 대신 서비스 역할로 구분한다.

| 물리 호스트 | 같은 PC에 설치된 서비스 |
| --- | --- |
| API 호스트 | FastAPI 2대, HAProxy 1대, Grafana, Prometheus |
| 웹 호스트 | Nginx 2대, HAProxy 1대, Loki |
| DB 호스트 | MariaDB 3대, MongoDB, HAProxy 1대 |

각 서비스는 별도 VM으로 운영하는 기록이며 전체 VM 수는 14대다.
기존 장비 기록은 Windows PC 3대, Intel Core i5-1340P, RAM 32GB, 전체 디스크 500GB다.
VM별 자원 기록과 호스트별 장애 영향은 [ADR-002](adr/002-windowsServerAllocation.md)에 모았다.
최초 제안의 Mac·100GB 예산은 현재 장비 사양으로 사용하지 않는다.

## 웹에서 FastAPI까지의 요청 경로

```text
브라우저 → 웹 앞단 HAProxy 181 → Nginx 177·178
        → API 앞단 HAProxy 179 → FastAPI 175·176
```

웹·API·DB 호스트의 HAProxy는 각각 별도 프록시다. 179는 API 앞단이며 DB 접속 주소가 아니다.
외부 HTTPS는 웹 앞단 HAProxy 181에서 종료하며 내부 구간 TLS는 연결 가이드의 선택 적용안이다.
[서버 연결 가이드](FrontToBackSetting.md)의 MariaDB 171 직접 접속은 11월 6일 기록이다.
DB용 HAProxy 경유는 [ADR-003](adr/003-dbConfiguration.md)의 구성 결정이며 실제 반영 확인과 구분한다.

## 실제 자원 할당을 확인할 항목

아래는 기존 문서에 수치·시험 결과가 없는 운영 점검 항목이며 서비스 배치가 불명확하다는 뜻이 아니다.

- VM별 기존 할당 기록과 현재 CPU·메모리·디스크 사용량
- FastAPI worker 수·DB 연결 풀, MariaDB buffer pool·연결 한도
- MariaDB 복제 방식·쓰기 가능 노드·DB 프록시 접속 전환 시험
- DB 백업·복구와 로그·메트릭 보관·삭제 동작

저장소 monitoring 설정은 Prometheus 187·Grafana 188·Loki 189와 서버별 로그 수집으로 통일했다. 설정과 적용 절차는 [monitoringSpec.md](monitoringSpec.md)를 따른다.
최신 전체 부하 검증은 [10차 결과](loadTestResult10.md)이며 DB 재구성 이후의 장애 전환 시험을 대신하지 않는다.

## 초기 자원 산정과 설계 근거

11월 5일 최초 제안은 [ADR-001](adr/001-serverSpec.md)에 보존한다.
통합 VM·Mac·worker 2개·DB 캐시 4GB/3GB는 당시 제안값이며 현재 적용값과 구분한다.
