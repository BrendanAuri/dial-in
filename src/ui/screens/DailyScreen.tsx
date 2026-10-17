import { useCallback, useEffect, useState } from 'react';
import { PACKS } from '../../content';
import { DAILY_FINISH_SCORE, DAILY_SUBMITS, STAR_SCORES } from '../../engine/constants';
import {
  calendarMark,
  dailyKey,
  dailyNumber,
  dailySeed,
  dailyTiers,
  isDailyDate,
  isTierAvailable,
  localDate,
  saveDaily,
  shareText,
  streaks,
  type DailyTierRef,
} from '../../game/daily';
import { recordRound } from '../../game/progress';
import { starsFor } from '../../scoring/finalScore';
import type { RoundResult } from '../../scoring/scoreRound';
import type { LiveAudio } from '../audio';
import { monthOf } from '../calendar';
import { DailyCalendar } from '../components/DailyCalendar';
import { RoundView, type Attempts, type RoundRules } from '../components/RoundView';
import { ShareBox } from '../components/ShareBox';
import { progressStore, useProgress } from '../progress';
import type { Navigate } from '../router';

const DAILY_RULES: RoundRules = { maxSubmits: DAILY_SUBMITS, hints: false, finishScore: DAILY_FINISH_SCORE };
const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

function formatDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return dateFormat.format(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)));
}

function tierId(ref: DailyTierRef): string {
  return `${ref.pack.id}/${ref.tier.id}`;
}

interface DailyScreenProps {
  readonly audio: LiveAudio;
  /** "YYYY-MM-DD"; today when omitted. */
  readonly date?: string | undefined;
  readonly navigate: Navigate;
}

/**
 * The daily challenge: one target per tier per day, the same for everyone.
 * Three submits, best counts, no hints, and the answer stays hidden until
 * you're done. Past days can be played from the archive, without counting
 * towards streaks.
 */
export function DailyScreen({ audio, date: requested, navigate }: DailyScreenProps) {
  const progress = useProgress();
  const store = progressStore();
  const today = localDate(new Date());
  const date = requested ?? today;
  const isToday = date === today;
  const tiers = dailyTiers(PACKS);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const open = tiers.filter((ref) => isTierAvailable(progress, ref));
    const unfinished = open.find((ref) => !progress.dailies[dailyKey(date, ref)]?.finished);
    const pick = unfinished ?? open[0] ?? tiers[0];
    return pick ? tierId(pick) : null;
  });
  const [month, setMonth] = useState(() => monthOf(date));
  const [replaying, setReplaying] = useState(false);
  // Whether each daily was already finished when opened here, so finishing one keeps its answer on screen.
  const [finishedWhenOpened, setFinishedWhenOpened] = useState<Readonly<Record<string, boolean>>>({});

  const selected = tiers.find((ref) => tierId(ref) === selectedId) ?? tiers[0];
  const key = selected ? dailyKey(date, selected) : null;
  const record = key ? progress.dailies[key] : undefined;
  const openedFinished = key ? (finishedWhenOpened[key] ?? record?.finished ?? false) : false;

  useEffect(() => {
    if (key && finishedWhenOpened[key] === undefined) {
      setFinishedWhenOpened((current) => ({ ...current, [key]: record?.finished ?? false }));
    }
  }, [key, record, finishedWhenOpened]);

  const onAttempts = useCallback(
    (attempts: Attempts) => {
      if (!key) return;
      store.update((p) =>
        saveDaily(p, key, { best: attempts.best ?? 0, submits: attempts.submits, finished: attempts.finished }, isToday),
      );
    },
    [key, store, isToday],
  );

  const onFirstResult = useCallback(
    (result: RoundResult) => store.update((p) => recordRound(p, result.params.controls)),
    [store],
  );

  if (!isDailyDate(date, today)) {
    return (
      <div className="screen">
        <p>There's no daily challenge for that date.</p>
        <button type="button" className="button primary" onClick={() => navigate({ name: 'daily' })}>
          Today's daily
        </button>
      </div>
    );
  }

  const streak = streaks(progress, today);
  const number = dailyNumber(date) ?? 0;

  return (
    <div className="screen daily-screen">
      <div className="screen-head">
        <button type="button" className="back-link" onClick={() => navigate({ name: 'home' })}>
          ← Home
        </button>
        <h1 className="screen-title">Daily #{number}</h1>
        <p className="card-note">
          {formatDate(date)}
          {isToday ? '' : ' · from the archive, so it won’t count towards your streak'}
        </p>
        <p className="streak">
          {streak.current > 0 ? `🔥 ${streak.current}-day streak` : 'No streak yet'} · best {streak.best}
          {isToday && !streak.playedToday && streak.current > 0 ? ' · play today to keep it going' : ''}
        </p>
      </div>

      {tiers.length === 0 ? (
        <p className="card-note">No daily challenges yet.</p>
      ) : (
        <div className="tier-tabs" role="tablist" aria-label="Daily tier">
          {tiers.map((ref) => {
            const tierRecord = progress.dailies[dailyKey(date, ref)];
            const available = isTierAvailable(progress, ref);
            const status = !available
              ? '🔒'
              : tierRecord?.finished
                ? `✓ ${tierRecord.best}`
                : tierRecord
                  ? `${tierRecord.submits}/${DAILY_SUBMITS}`
                  : '';
            return (
              <button
                key={tierId(ref)}
                type="button"
                role="tab"
                aria-selected={tierId(ref) === tierId(selected ?? ref)}
                className={tierId(ref) === tierId(selected ?? ref) ? 'tier-tab current' : 'tier-tab'}
                onClick={() => {
                  setSelectedId(tierId(ref));
                  setReplaying(false);
                }}
              >
                <span>{ref.tier.title}</span>
                {status && <span className="tier-status">{status}</span>}
              </button>
            );
          })}
        </div>
      )}

      {selected && key && (
        <DailyBody
          audio={audio}
          date={date}
          number={number}
          dailyRef={selected}
          dailyKeyValue={key}
          record={record}
          openedFinished={openedFinished}
          replaying={replaying}
          onReplay={setReplaying}
          onAttempts={onAttempts}
          onFirstResult={onFirstResult}
          navigate={navigate}
        />
      )}

      <h2 className="section-title">Archive</h2>
      <DailyCalendar
        month={month}
        today={today}
        selected={date}
        markFor={(day) => calendarMark(progress, day)}
        isAvailable={(day) => isDailyDate(day, today)}
        onPick={(day) => navigate({ name: 'daily', date: day === today ? undefined : day })}
        onMonth={setMonth}
      />
    </div>
  );
}

interface DailyBodyProps {
  readonly audio: LiveAudio;
  readonly date: string;
  readonly number: number;
  readonly dailyRef: DailyTierRef;
  readonly dailyKeyValue: string;
  readonly record: { readonly best: number; readonly submits: number; readonly finished: boolean } | undefined;
  readonly openedFinished: boolean;
  readonly replaying: boolean;
  readonly onReplay: (replaying: boolean) => void;
  readonly onAttempts: (attempts: Attempts) => void;
  readonly onFirstResult: (result: RoundResult) => void;
  readonly navigate: Navigate;
}

/** The selected tier: locked, the round, or (if finished before) the result to share. */
function DailyBody(props: DailyBodyProps) {
  const { dailyRef, record, date } = props;
  const { pack, tier, level } = dailyRef;
  const progress = useProgress();
  const seed = dailySeed(date, dailyRef);
  const share = record?.finished ? shareText(date, tier.title, record, DAILY_SUBMITS) : null;

  if (!isTierAvailable(progress, dailyRef)) {
    return (
      <div className="card">
        <p>
          Pass <strong>{level.title}</strong> to unlock the {tier.title} daily.
        </p>
        <button
          type="button"
          className="button primary"
          onClick={() => props.navigate({ name: 'level', packId: pack.id, levelId: level.id })}
        >
          Go to {level.title}
        </button>
      </div>
    );
  }

  if (props.replaying) {
    return (
      <>
        <button type="button" className="back-link" onClick={() => props.onReplay(false)}>
          ← Back to your result
        </button>
        <RoundView
          key={`replay:${props.dailyKeyValue}`}
          audio={props.audio}
          pack={pack}
          level={level}
          seed={seed}
          heading={<span>{tier.title} · replay, not scored</span>}
          nextLabel={null}
        />
      </>
    );
  }

  if (record?.finished && props.openedFinished) {
    const stars = starsFor(record.best);
    return (
      <section className="card daily-done" aria-labelledby="daily-done-title">
        <h2 id="daily-done-title" className="card-kicker">
          {tier.title}: done
        </h2>
        <div className="result-head">
          <div className="result-score">{record.best}</div>
          <div className="result-summary">
            <div className="stars" aria-label={`${stars} of ${STAR_SCORES.length} stars`}>
              {STAR_SCORES.map((needed, i) => (
                <span key={needed} className={i < stars ? 'star-icon on' : 'star-icon'} aria-hidden="true">
                  ★
                </span>
              ))}
            </div>
            <div className="result-detail">
              {record.submits} of {DAILY_SUBMITS} submits
            </div>
          </div>
        </div>
        {share && <ShareBox text={share} />}
        <div className="form-actions">
          <button type="button" className="button" onClick={() => props.onReplay(true)}>
            Play it again (not scored)
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      {share && <ShareBox text={share} />}
      <RoundView
        key={`daily:${props.dailyKeyValue}`}
        audio={props.audio}
        pack={pack}
        level={level}
        seed={seed}
        heading={
          <span>
            {tier.title} · Daily #{props.number}
          </span>
        }
        nextLabel={null}
        rules={DAILY_RULES}
        saved={record ? { submits: record.submits, best: record.best, finished: record.finished } : undefined}
        onAttempts={props.onAttempts}
        onFirstResult={props.onFirstResult}
      />
    </>
  );
}
