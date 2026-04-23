import {
  DEAD_MAN_SWITCH_DELAY_OPTIONS,
  DEAD_MAN_SWITCH_WARNING_STAGES,
} from '@/lib/constants';

export type DeadManSwitchDelayMonths =
  (typeof DEAD_MAN_SWITCH_DELAY_OPTIONS)[number];
export type DeadManSwitchWarningStage =
  (typeof DEAD_MAN_SWITCH_WARNING_STAGES)[number];

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface DeadManSwitchStateInput {
  enabled: boolean;
  delayMonths: number | null;
  lastActiveAt: string | null;
  createdAt: string | null;
  warning30SentAt?: string | null;
  warning7SentAt?: string | null;
  warning1SentAt?: string | null;
  transferredAt?: string | null;
}

export interface DeadManSwitchComputedState {
  anchorDate: string | null;
  transferDate: string | null;
  daysUntilTransfer: number | null;
  confirmationVisible: boolean;
  transferDue: boolean;
  activeWarningStage: DeadManSwitchWarningStage | null;
}

function toDate(value?: string | null) {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(value: Date) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    0,
    0,
    0,
    0
  );
}

export function isValidDeadManSwitchDelay(
  value: number | null | undefined
): value is DeadManSwitchDelayMonths {
  return DEAD_MAN_SWITCH_DELAY_OPTIONS.includes(
    value as DeadManSwitchDelayMonths
  );
}

export function formatDeadManSwitchDelayLabel(months: number) {
  if (months === 12) return '1 year';
  if (months === 24) return '2 years';
  return `${months} months`;
}

export function addMonthsPreservingDate(base: Date, months: number) {
  const result = new Date(base);
  const day = result.getDate();

  result.setMonth(result.getMonth() + months);

  if (result.getDate() !== day) {
    result.setDate(0);
  }

  return result;
}

export function getDeadManSwitchAnchorDate(input: DeadManSwitchStateInput) {
  const lastActive = toDate(input.lastActiveAt);
  const createdAt = toDate(input.createdAt);
  const base = lastActive || createdAt;

  return base ? new Date(base) : null;
}

export function getDeadManSwitchTransferDate(input: DeadManSwitchStateInput) {
  const anchorDate = getDeadManSwitchAnchorDate(input);
  const delayMonths = isValidDeadManSwitchDelay(input.delayMonths)
    ? input.delayMonths
    : 12;

  if (!input.enabled || !anchorDate) {
    return null;
  }

  return addMonthsPreservingDate(anchorDate, delayMonths);
}

export function getDaysUntilDeadManSwitchTransfer(
  transferDate: Date,
  now = new Date()
) {
  return Math.ceil(
    (startOfDay(transferDate).getTime() - startOfDay(now).getTime()) / MS_PER_DAY
  );
}

export function getDeadManSwitchWarningTimestamp(
  input: DeadManSwitchStateInput,
  stage: DeadManSwitchWarningStage
) {
  switch (stage) {
    case 30:
      return input.warning30SentAt || null;
    case 7:
      return input.warning7SentAt || null;
    case 1:
      return input.warning1SentAt || null;
    default:
      return null;
  }
}

export function hasDeadManSwitchWarningBeenSentForCycle(
  input: DeadManSwitchStateInput,
  stage: DeadManSwitchWarningStage
) {
  const anchorDate = getDeadManSwitchAnchorDate(input);
  const sentAt = toDate(getDeadManSwitchWarningTimestamp(input, stage));

  if (!anchorDate || !sentAt) {
    return false;
  }

  return sentAt.getTime() >= anchorDate.getTime();
}

export function getMostUrgentDueDeadManSwitchWarning(
  input: DeadManSwitchStateInput,
  now = new Date()
) {
  const transferDate = getDeadManSwitchTransferDate(input);
  if (!transferDate || toDate(input.transferredAt)) {
    return null;
  }

  const daysUntilTransfer = getDaysUntilDeadManSwitchTransfer(transferDate, now);

  if (daysUntilTransfer <= 0) {
    return null;
  }

  for (const stage of [...DEAD_MAN_SWITCH_WARNING_STAGES].reverse()) {
    if (
      daysUntilTransfer <= stage &&
      !hasDeadManSwitchWarningBeenSentForCycle(input, stage)
    ) {
      return stage;
    }
  }

  return null;
}

export function getDeadManSwitchComputedState(
  input: DeadManSwitchStateInput,
  now = new Date()
): DeadManSwitchComputedState {
  const anchorDate = getDeadManSwitchAnchorDate(input);
  const transferDate = getDeadManSwitchTransferDate(input);
  const transferredAt = toDate(input.transferredAt);

  if (!anchorDate || !transferDate || transferredAt) {
    return {
      anchorDate: anchorDate?.toISOString() || null,
      transferDate: transferDate?.toISOString() || null,
      daysUntilTransfer: null,
      confirmationVisible: false,
      transferDue: false,
      activeWarningStage: null,
    };
  }

  const daysUntilTransfer = getDaysUntilDeadManSwitchTransfer(transferDate, now);
  let activeWarningStage: DeadManSwitchWarningStage | null = null;

  for (const stage of [...DEAD_MAN_SWITCH_WARNING_STAGES].reverse()) {
    if (daysUntilTransfer > 0 && daysUntilTransfer <= stage) {
      activeWarningStage = stage;
      break;
    }
  }

  return {
    anchorDate: anchorDate.toISOString(),
    transferDate: transferDate.toISOString(),
    daysUntilTransfer,
    confirmationVisible: daysUntilTransfer > 0 && daysUntilTransfer <= 30,
    transferDue: daysUntilTransfer <= 0,
    activeWarningStage,
  };
}

export function getDeadManSwitchWarningCopy(stage: DeadManSwitchWarningStage) {
  if (stage === 30) {
    return {
      subject: 'Your account will be transferred in 30 days',
      title: 'Your account will be transferred in 30 days.',
      body: 'Click below to confirm you are still active and reset the countdown.',
      buttonLabel: 'Confirm that you are still active',
    };
  }

  if (stage === 7) {
    return {
      subject: 'Urgent: your account transfer is in 7 days',
      title: 'Your account will be transferred in 7 days.',
      body: 'This is your urgent reminder to confirm activity before stewardship changes hands.',
      buttonLabel: 'Confirm activity now',
    };
  }

  return {
    subject: 'Critical: your account will be transferred tomorrow',
    title: 'Your account will be transferred tomorrow.',
    body: 'This is the final notice before the transfer takes place.',
    buttonLabel: 'Confirm activity now',
  };
}
