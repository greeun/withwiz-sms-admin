# @withwiz/sms-admin

[English](./README.md) | **한국어**

SMS 발송 이력·템플릿 관리 서비스와 관리자 UI. `@withwiz/sms-core`의 provider를 주입받아 동작한다.

## 설치

```bash
pnpm add @withwiz/sms-admin @withwiz/sms-core
```

`@prisma/client`·`react`는 peerDependency로, 소비 프로젝트가 이미 갖춘 버전을 그대로 사용한다. 이 패키지는 Next.js 프로젝트에서 쓰는 것을 전제로 한다. `sonner`도 peerDependency이지만 선택 사항이다. 패키지가 `sonner`를 직접 가져오지 않고 `SmsAdminProvider`의 `notify`로 알림 함수를 주입받는 구조이므로, 설치하지 않아도 동작은 하되 알림만 표시되지 않는다.

## Prisma 스키마

`prisma/sms.prisma`를 소비 프로젝트의 스키마 디렉터리로 복사한다.

```bash
cp node_modules/@withwiz/sms-admin/prisma/sms.prisma prisma/schema/sms/
```

## 서버 사용

provider 어댑터는 `@withwiz/sms-core`의 루트 진입점이 아니라 서브 경로에서 가져온다. 루트에서 함께 내보내면 서버 전용 코드가 클라이언트 번들에 섞이기 때문이다.

```typescript
import { createSmsAdmin } from '@withwiz/sms-admin/facade';
import { createAligoProvider } from '@withwiz/sms-core/providers/aligo';

export const smsAdmin = createSmsAdmin({
  prisma,
  provider: createAligoProvider({ credentials: loadCredentials }),
  logger,
  // 발신번호를 읽는 함수. 설정 변경이 즉시 반영되도록 호출 시점에 읽는다.
  sender: async () => (await getSettings(['sms_sender'])).sms_sender ?? '',
});
```

`smsAdmin`이 제공하는 표면은 다음과 같다.

```typescript
// 발송
const result = await smsAdmin.messages.send({
  type: 'SMS',
  content: '안내 문자입니다.',
  recipients: [{ name: '홍길동', phone: '010-1234-5678' }],
  source: 'briefing',
});

// 발송 이력 조회·삭제
const { items, total } = await smsAdmin.messages.list({ page: 1, limit: 20 });
const detail = await smsAdmin.messages.detail(result.messageId);
await smsAdmin.messages.remove([result.messageId]);

// 템플릿 관리
const templates = await smsAdmin.templates.list({ search: '입학' });
await smsAdmin.templates.create({ name: '입학 안내', type: 'SMS', content: '...' });

// 잔여 발송 건수, CSV 내보내기
const remain = await smsAdmin.remain();
const csv = smsAdmin.csv.buildMessageCsv(items);
```

`createSmsAdmin` 설정 항목은 다음과 같다.

| 항목 | 설명 |
|------|------|
| `prisma` | 소비 프로젝트의 `PrismaClient`. `sms.prisma`가 정의하는 세 모델에 접근할 수 있어야 한다 |
| `provider` | `@withwiz/sms-core`의 `SmsProvider` 구현체(예: `@withwiz/sms-core/providers/aligo`의 `createAligoProvider`) |
| `logger` | `info` / `warn` / `error`를 갖는 최소 로거 인터페이스 |
| `sender` | 발신번호를 읽는 함수. 발송 시점마다 호출하므로 설정 변경이 즉시 반영된다 |

서비스가 던지는 오류는 두 종류로 나뉜다. 잘못된 정렬 키, 필수 입력 누락처럼 호출 측 입력이 잘못된 경우에는 `SmsValidationError`를 던지고, 그 밖의 오류(Prisma 연결 실패, 존재하지 않는 id로 update·delete 등)는 일반 `Error`를 그대로 전파한다. 소비 프로젝트는 `isSmsValidationError`로 이 둘을 구분해서, 검증 오류는 400으로 응답하고 그 외에는 내부 메시지를 노출하지 않는 500으로 처리해야 한다.

```typescript
import { isSmsValidationError } from '@withwiz/sms-admin';

try {
  const { items, total } = await smsAdmin.templates.list({ sort: req.query.sort });
  return NextResponse.json({ success: true, data: { items, total } });
} catch (err) {
  if (isSmsValidationError(err)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_PARAM', message: err.message } },
      { status: 400 },
    );
  }
  logger.error('sms template list 실패', err);
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL_ERROR', message: '요청을 처리하지 못했습니다.' } },
    { status: 500 },
  );
}
```

## UI 사용

```tsx
import { SmsAdminProvider, SmsSendForm } from '@withwiz/sms-admin/components';

<SmsAdminProvider
  config={{
    fetcher: adminFetch,
    onUploadImage,
    resolveImageUrl: variantUrl,
    notify: { success: toast.success, warning: toast.warning, error: toast.error },
  }}
>
  <SmsSendForm
    // ClassRecipientPicker는 예시일 뿐 패키지가 제공하는 컴포넌트가 아니다.
    // 프로젝트마다 다른 대상 선택 화면을 recipientPicker 자리에 끼워 넣으면 된다.
    recipientPicker={(onAddRecipients) => <ClassRecipientPicker onAdd={onAddRecipients} />}
    source="briefing"
    onNavigateToHistory={() => router.push('/admin/sms/history')}
    onNavigateToTemplates={() => router.push('/admin/sms/templates')}
  />
</SmsAdminProvider>
```

`SmsAdminProvider`의 `config`(`SmsAdminUiConfig`) 항목은 다음과 같다.

| 항목 | 설명 | 기본값 |
|------|------|--------|
| `basePath` | SMS API 묶음의 기본 경로 | `/api/admin/sms` |
| `fetcher` | 인증 헤더가 붙은 fetch 함수 (`adminFetch` 형태) | 필수 |
| `onUploadImage` | 이미지 업로드 함수. 업로드된 공개 URL을 반환한다 | - |
| `resolveImageUrl` | 변형 이미지 URL 규칙 | 주입하지 않으면 원본 URL을 그대로 사용 |
| `notify` | `success` / `warning` / `error` 알림 함수 | 주입하지 않으면 알림을 건너뜀 |
| `recipientStorageKey` | 다른 화면에서 담아 온 수신자를 읽어 오는 `sessionStorage` 키. `SmsSendForm`이 첫 렌더에서 한 번 읽고 지운다 | `sms_recipients` |

### 컴포넌트

| 컴포넌트 | 설명 |
|----------|------|
| `SmsAdminProvider` | 설정을 하위 컴포넌트에 주입한다. `useSmsAdminConfig` 훅으로 읽을 수 있다 |
| `SmsSendForm` | 수신자 추가, 템플릿 적용, 이미지 업로드를 포함한 발송 폼 |
| `RecipientList` | 수신자 추가·삭제 목록 |
| `TemplateSelector` | 템플릿 불러오기·저장 |
| `SmsDetailView` | 발송 상세 조회 화면 |

컴포넌트는 아니지만 `formatDateTime(value: string | Date | null | undefined): string`도 같은 서브 경로(`@withwiz/sms-admin/components`)에서 내보낸다. 관리자 화면의 날짜 표기(`YYYY-MM-DD HH:mm:ss`)를 패키지 컴포넌트와 동일하게 맞추고 싶은 소비 프로젝트가 쓴다.

`SmsSendForm`의 props는 다음과 같다.

| prop | 설명 |
|------|------|
| `recipientPicker` | 학급 단위 선택 등 프로젝트별 대상 선택 화면. `onAddRecipients`를 호출해 선택 결과를 폼에 전달한다 |
| `onSent` | 발송이 끝난 뒤 `messageId`를 받아 호출된다. 화면 이동은 소비 측이 결정한다 |
| `source` | 발송을 유발한 화면 식별자 |
| `onNavigateToHistory` | 상단 "발송 기록" 버튼 클릭 시 호출된다. 넘기지 않으면 버튼을 그리지 않는다 |
| `onNavigateToTemplates` | 상단 "템플릿 관리" 버튼 클릭 시 호출된다. 넘기지 않으면 버튼을 그리지 않는다 |

`SmsDetailView`는 `messageId`와 선택적 `onBack` 콜백을 받는다.

```tsx
import { SmsDetailView } from '@withwiz/sms-admin/components';

<SmsDetailView messageId={message.id} onBack={() => router.push('/admin/sms/history')} />
```

## 상수

서비스 계층과 UI 컴포넌트, 소비 프로젝트의 라우트 핸들러가 함께 쓰는 정적 값은 별도 진입점에서 내보낸다. 순수한 값만 담고 있어서 서버 전용 코드도 `"use client"` 지시문도 붙지 않으므로, 라우트 핸들러와 클라이언트 컴포넌트가 모두 이 진입점에서 가져올 수 있다.

```typescript
import { MAX_PAGE_SIZE, SMS_ENDPOINTS } from '@withwiz/sms-admin/constants';

// 라우트 핸들러는 서비스가 강제하는 것과 동일한 상한으로 페이지 크기를 제한하고,
// 컴포넌트가 요청하는 것과 동일한 세그먼트로 경로를 구성할 수 있다.
const limit = Math.min(Number(searchParams.get('limit')) || 20, MAX_PAGE_SIZE);
```

| 상수 | 값 | 용도 |
|------|-----|------|
| `DEFAULT_BASE_PATH` | `/api/admin/sms` | `SmsAdminUiConfig.basePath`를 넘기지 않았을 때 적용되는 기본 경로 |
| `SMS_ENDPOINTS` | `{ send, remain, templates, detail(id) }` | 기본 경로 뒤에 붙는 엔드포인트 세그먼트 |
| `DEFAULT_RECIPIENT_STORAGE_KEY` | `sms_recipients` | `recipientStorageKey`를 넘기지 않았을 때 적용되는 sessionStorage 키 |
| `LMS_MAX_BYTES` / `SUBJECT_MAX_BYTES` | `2000` / `40` | LMS와 MMS의 본문 및 제목 바이트 제한 |
| `MAX_CONTENT_BYTES` | 메시지 유형별 | 유형별 본문 제한. SMS 항목은 `@withwiz/sms-core`의 `SMS_MAX_BYTES`를 재사용하므로 90바이트 제한이 한곳에만 정의된다 |
| `DEFAULT_PAGE_SIZE` / `MAX_PAGE_SIZE` | `20` / `200` | 기본 페이지 크기와 템플릿 서비스가 강제하는 상한 |
| `REMAIN_LOW_THRESHOLD` / `REMAIN_WARN_THRESHOLD` | `100` / `1000` | 잔여 건수 표시의 색상이 바뀌는 임계값 |
| `PHONE_INPUT_MAX_LENGTH` | `13` | 전화번호 입력란의 `maxLength` |
| `ALLOWED_IMAGE_MIME` / `ALLOWED_IMAGE_ACCEPT` | `image/jpeg`, `image/jpg` | 발송 폼이 허용하는 MIME 타입과, 이를 `accept` 속성 형태로 표현한 값 |

루트 진입점도 이 값들을 다시 내보내지만 루트는 서버 전용이다. 클라이언트 컴포넌트는 반드시 `@withwiz/sms-admin/constants`에서 가져와야 한다.

## 라이선스

MIT
