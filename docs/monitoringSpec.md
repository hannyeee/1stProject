# 모니터링 설정

| 서비스 | 주소 | 역할 |
| --- | --- | --- |
| Prometheus | `192.168.0.187:9090` | exporter 메트릭 직접 수집 |
| Grafana | `192.168.0.188:3000` | Prometheus·Loki 조회 |
| Loki | `192.168.0.189:3100` | 로그 저장 |
| Alloy | 서버 14대 | 로그를 Loki 189로 전송 |

## 기준 파일

- [Prometheus](../monitoring/prometheus/prometheus.yml): 171~181·187~189의 node_exporter(9100), MariaDB 171~173(9104), MongoDB 174(9216), 모니터링 서비스 자체 메트릭.
- [Grafana 연결](../monitoring/grafana/provisioning/datasources/datasources.yml): Prometheus 187, Loki 189. [대시보드](../monitoring/grafana/dashboards)의 UID와 일치한다.
- [Alloy 생성기·서버별 설정](../monitoring/deployed/alloy): 로그 전용. 예전 remote_write·역할별 분할 템플릿은 제거했다.
- [Loki](../monitoring/loki/config.yml): [배포 사본](../monitoring/deployed/loki/config.yml)과 동일하며 `/var/lib/loki`에 저장한다.
- [서비스 자원 제한](../monitoring/systemd/README.md): 각 서비스 VM에 적용한다.

## Alloy 적용

저장소 루트에서 `python monitoring/deployed/alloy/gen_alloy.py`로 파일을 생성한다.
각 VM에는 해당 IP의 파일 하나를 `/etc/alloy/config.alloy`로 복사하고
[alloy.default](../monitoring/alloy/alloy.default)를 `/etc/default/alloy`로 복사한다.
이전처럼 여러 `.alloy` 파일을 합쳐 읽지 않는다.

Nginx는 [JSON 접근 로그 설정](../monitoring/nginx/monitoring.conf)의 `access.json.log`와 `error.log`,
HAProxy는 rsyslog의 `haproxy.log`, 전체 서버는 journald를 수집한다.
Alloy 사용자는 `adm,systemd-journal` 그룹의 읽기 권한이 필요하다.

## 주기·보관

- exporter 메트릭 30초, 모니터링 서비스 자체 메트릭 60초, Grafana 최소 새로고침 30초.
- Prometheus: 7일 또는 TSDB 블록 15GB. Loki: 72시간·compactor 삭제.
- FastAPI `/metrics`를 가정한 scrape·규칙은 제거했다. 현재 앱에는 계측이 없다.
- 전체 디스크 사용량과 exporter의 실제 실행·접근 가능 여부는 배포 시 확인한다.

## 검증

```powershell
python -m pip install -r monitoring/requirements.txt
python -m unittest discover -s monitoring/tests -v
```

VM에서는 `promtool check config`, `promtool check rules`, `alloy validate` 후 서비스를 적용하고
Prometheus Targets·Grafana 연결·Loki 로그 유입을 확인한다.
검증 명령: [Prometheus](https://prometheus.io/docs/prometheus/latest/configuration/configuration/),
[Alloy](https://grafana.com/docs/alloy/latest/reference/cli/validate/).
