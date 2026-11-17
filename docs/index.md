# 문서 안내

기능·실행·인프라 문서는 주제별로, 부하 테스트 결과는 실행 시작 시각 순으로 찾는다.

## 문서를 읽는 기준

- 현재 기능·API는 아래 기능 문서와 저장소 코드, 실행 방법은 해당 실행기 안내를 따른다.
- 결과 보고서와 작업 계획은 작성 당시의 기록이다. 과거의 실패·미배포와 이후 수정 완료는 시점·실행 ID를 구분한다.
- 서버 수량·동거 관계는 사용자 확인을 반영한 [서버 구성](serverSpec.md), IP별 역할은 [네트워크 정보](networkInfo.md)를 따른다. 과거 제안과 현재 배치는 구분한다.
- 모니터링 구성과 적용은 [monitoringSpec.md](monitoringSpec.md)를 따른다.

## 기능·개발 안내

| 목적 | 기준 문서 |
| --- | --- |
| 백엔드 공통 구조·인증·로컬 실행 | [backend.md](backend.md) |
| 프론트엔드 구조·화면·로컬 실행 | [frontend.md](frontend.md) |
| 예매·모의 결제·취소·상태·API | [booking.md](booking.md) |
| 마이페이지 리포트·알림·탈퇴 | [mypageApi.md](mypageApi.md) |
| 관리자 권한·공연 관리 | [admin.md](admin.md) |
| 행동 이벤트 형식·전송·식별자 | [eventTracking.md](eventTracking.md) |
| 가상 프로필 구조·생성·확장 규칙 | [personaDataDesign.md](personaDataDesign.md) |
| 홈 화면의 기존 디자인 기준 | [homeDesign.md](homeDesign.md) |
| 커밋 메시지 규칙 | [gitCommitConvention.md](gitCommitConvention.md) |
| 평가 피드백 기반 개선 우선순위·완료 기준 | [improvementPlan.md](improvementPlan.md) |

## 테스트 실행 안내

| 목적 | 기준 문서 |
| --- | --- |
| 브라우저 자동화·두 API 부하 실행기·실행 기록 안내 | [playwrightGuide.md](playwrightGuide.md) |
| 이후 API 부하 실행기 명령·모델·중단 기준 | [loadTestGuide.md](loadTestGuide.md) |
| 구형 300명 실행 계획(과거 기록, 코드 보관) | [loadTestPlan.md](loadTestPlan.md) |

## 부하 테스트 결과

문서 회차는 실행 시작 시각(KST) 순이다. 1차와 2차는 서로 다른 실행기로 진행되어 시간이 겹친다.
각 회차는 대표 실행 기준이며 본문에 별도 실행 ID의 재시도·단독 검사가 포함될 수 있다.
실행 ID와 `full3` 같은 원본 기록의 이름은 실제 실행 기록을 대조할 수 있도록 각 문서에 유지한다.
최종 개선 상태의 전체 검증 결과는 [10차 결과](loadTestResult10.md)에서 확인한다.

| 회차 | 실행 시작(KST) | 테스트 내용 | 결과 문서 |
| --- | --- | --- | --- |
| 1차 | 11월 6일 20:43 | 최초 단계별 API 부하·집중 부하 중 중단 | [loadTestResult01.md](loadTestResult01.md) |
| 2차 | 11월 6일 21:01 | 300명 프로필 기반 API 부하·혼합 단계 중단 | [loadTestResult02.md](loadTestResult02.md) |
| 3차 | 11월 7일 08:35 | 1~200 VU 스트레스 | [loadTestResult03.md](loadTestResult03.md) |
| 4차 | 11월 7일 09:06 | 50 VU·5분 DB 변화 관찰 | [loadTestResult04.md](loadTestResult04.md) |
| 5차 | 11월 7일 09:25 | 전체 재실행·동시 요청의 500 오류 확인 | [loadTestResult05.md](loadTestResult05.md) |
| 6차 | 11월 7일 12:03 | 동시성 수정 배포 후 검증 | [loadTestResult06.md](loadTestResult06.md) |
| 7차 | 11월 7일 20:42 | 데드락 재시도 반영 후 전체 재실행 | [loadTestResult07.md](loadTestResult07.md) |
| 8차 | 11월 8일 10:36 | 복합 인덱스 적용 후 조회 부하 | [loadTestResult08.md](loadTestResult08.md) |
| 9차 | 11월 8일 18:00 | 인덱스·재시도 반영 후 반복 부하 | [loadTestResult09.md](loadTestResult09.md) |
| 10차 | 11월 8일 21:47 | 트랜잭션 개선 후 최종 전체 부하·13단계 통과 | [loadTestResult10.md](loadTestResult10.md) |

## 인프라·데이터 설계

| 목적 | 기준 문서 |
| --- | --- |
| 최신 IP·서버 역할·담당자 | [networkInfo.md](networkInfo.md) |
| 서버 구성 범위·미확정 자원 | [serverSpec.md](serverSpec.md) |
| 실서버 연결·HAProxy·nginx·TLS 절차 | [FrontToBackSetting.md](FrontToBackSetting.md) |
| 모니터링 구성·수집 지표 | [monitoringSpec.md](monitoringSpec.md) |
| 최초 서버 사양 제안(과거 가정) | [001-serverSpec.md](adr/001-serverSpec.md) |
| Windows 서버 역할 배치 결정 기록 | [002-windowsServerAllocation.md](adr/002-windowsServerAllocation.md) |
| DB 구성 결정 기록 | [003-dbConfiguration.md](adr/003-dbConfiguration.md) |

## 과거 설계·작업 이력

아래는 작성 당시의 제안·작업 기록이다. 현재 실행 지침이나 미완료 작업 지시로 해석하지 않는다.
최신 구현과 실행 결과는 위 기준 문서를 우선한다.

- [초기 서버 배치 제안·자원 산정](adr/001-serverSpec.md): 현재 배치와 구분해 보존한 과거 설계 가정.
- [관리자 기능 구현 계획](superpowers/plans/2026-11-05-admin-performances.md): 2026-11-05 작업 기록.
- [마이페이지 구현 계획](superpowers/plans/2026-11-05-mypage-features.md): 2026-11-05 작업 기록.
- [부하 중단·재개 구현 계획](superpowers/plans/2026-11-06-load-test-resume.md): 2026-11-06 복구 기록.
