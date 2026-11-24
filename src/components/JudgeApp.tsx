"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { normalizeName } from "@/lib/names";
import {
  GROUPS,
  ITEM_LIST,
  TOTAL_MAX,
  type ItemKey,
  type ScoreMap,
} from "@/lib/rubric";
import { Header } from "./Header";

const HALL_KEY = "pdd-hall-key";
const NAME_KEY = "pdd-judge-name";

type Phase = "loading" | "gate" | "name" | "list" | "score" | "done";
type Listed = { id: string; name: string; total: number | null };

export function JudgeApp() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [gateText, setGateText] = useState("请通过组织者分享的会场二维码进入评分。");
  const [hallKey, setHallKey] = useState("");
  const [judgeName, setJudgeName] = useState("");
  const [draftName, setDraftName] = useState("");
  const [candidates, setCandidates] = useState<Listed[]>([]);
  const [active, setActive] = useState<Listed | null>(null);
  const [scores, setScores] = useState<Partial<ScoreMap>>({});
  const [existing, setExisting] = useState(false);
  const [scoreReady, setScoreReady] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultTotal, setResultTotal] = useState<number | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("k")?.trim() ?? "";
    const stored = window.localStorage.getItem(HALL_KEY)?.trim() ?? "";
    const key = fromUrl || stored;
    const savedName = window.localStorage.getItem(NAME_KEY) ?? "";
    if (!key) {
      setGateText("请通过组织者分享的会场二维码进入评分。");
      setPhase("gate");
      return;
    }
    if (fromUrl) window.localStorage.setItem(HALL_KEY, fromUrl);
    setHallKey(key);
    setJudgeName(savedName);
    setDraftName(savedName);
    void openList(key, savedName, savedName ? "list" : "name");
  }, []);

  async function openList(key: string, name: string, next: "list" | "name") {
    setError("");
    try {
      const data = await api<{ candidates: Listed[] }>(
        `/api/hall/candidates?judgeName=${encodeURIComponent(name)}`,
        { hallKey: key },
      );
      setCandidates(Array.isArray(data.candidates) ? data.candidates : []);
      setPhase(next);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "会场链接无效";
      if (message.includes("无效") || message.includes("登录")) {
        window.localStorage.removeItem(HALL_KEY);
        setHallKey("");
        setGateText("会场链接无效，请向组织者索取最新二维码。");
        setPhase("gate");
        return;
      }
      setError(message);
      setPhase(next);
    }
  }

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    const name = normalizeName(draftName);
    if (!name) {
      setError("请填写评委姓名");
      return;
    }
    window.localStorage.setItem(NAME_KEY, name);
    setJudgeName(name);
    setDraftName(name);
    await openList(hallKey, name, "list");
  }

  async function openCandidate(candidate: Listed) {
    setActive(candidate);
    setScores({});
    setExisting(false);
    setScoreReady(false);
    setError("");
    setResultTotal(null);
    setPhase("score");
    try {
      const data = await api<{ score: { scores: ScoreMap; total: number } | null }>(
        `/api/hall/score?candidateId=${encodeURIComponent(candidate.id)}&judgeName=${encodeURIComponent(judgeName)}`,
        { hallKey },
      );
      if (data.score) {
        setScores(data.score.scores);
        setExisting(true);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载失败");
    } finally {
      setScoreReady(true);
    }
  }

  const picked = ITEM_LIST.filter((item) => typeof scores[item.key] === "number").length;
  const live = ITEM_LIST.reduce((sum, item) => sum + (scores[item.key] ?? 0), 0);
  const complete = picked === ITEM_LIST.length;

  const activeGroups = useMemo(() => GROUPS, []);

  async function submit() {
    if (!active || !complete) return;
    setSubmitting(true);
    setError("");
    try {
      const data = await api<{ total: number }>("/api/hall/score", {
        method: "POST",
        hallKey,
        body: { candidateId: active.id, judgeName, scores },
      });
      setResultTotal(data.total);
      setExisting(true);
      setConfirming(false);
      setPhase("done");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "提交失败");
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={phase === "score" ? "screen with-dock" : "screen"}>
      <Header sub="年终答辩 · 满分 120" />
      {phase === "loading" ? <p className="muted">正在打开…</p> : null}

      {phase === "gate" ? (
        <section className="card stack" data-testid="gate">
          <h2>会场入口</h2>
          <p>{gateText}</p>
          <p className="muted">组织者请先设置管理密码，并添加答辩人。评委扫描会场二维码后即可打分。</p>
          <a className="btn" href="/admin">
            打开管理页
          </a>
        </section>
      ) : null}

      {phase === "name" ? (
        <form className="card stack" onSubmit={saveName}>
          <h2>评委姓名</h2>
          <p className="muted">必填。姓名会记在这台设备上，同一姓名对同一答辩人再次提交就是改分。</p>
          <label className="field">
            评委姓名
            <input
              data-testid="judge-name-input"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              autoComplete="name"
              enterKeyHint="done"
              maxLength={40}
              required
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn" data-testid="judge-name-submit" type="submit">
            开始评分
          </button>
        </form>
      ) : null}

      {phase === "list" ? (
        <section>
          <div className="who">
            <strong data-testid="judge-banner">评委：{judgeName}</strong>
            <button
              className="linkish"
              type="button"
              data-testid="change-judge"
              onClick={() => {
                setDraftName(judgeName);
                setPhase("name");
              }}
            >
              更换
            </button>
          </div>
          <h2 className="section-title">选择答辩人</h2>
          {error ? <p className="error">{error}</p> : null}
          {candidates.length === 0 ? (
            <div className="card" data-testid="empty-candidates">
              <p>暂无答辩人。</p>
              <p>请组织者先在管理页添加答辩人。</p>
              <a className="btn" href="/admin">
                打开管理页
              </a>
            </div>
          ) : (
            candidates.map((candidate) => (
              <button
                key={candidate.id}
                className="person"
                type="button"
                data-testid="pick-candidate"
                data-name={candidate.name}
                onClick={() => void openCandidate(candidate)}
              >
                <span>{candidate.name}</span>
                <span className={candidate.total === null ? "badge" : "badge done"}>
                  {candidate.total === null ? "未评" : `已评 ${candidate.total}分`}
                </span>
              </button>
            ))
          )}
          <p className="foot">
            <a href="/admin">组织者入口</a>
          </p>
        </section>
      ) : null}

      {phase === "score" && active ? (
        <section>
          <div className="who">
            <button className="linkish" type="button" onClick={() => void openList(hallKey, judgeName, "list")}>
              返回名单
            </button>
            <strong>{active.name}</strong>
          </div>
          {existing ? <p className="hint">你已提交过评分，修改后再次提交将更新。</p> : null}
          {!scoreReady ? <p className="muted">正在读取已有评分…</p> : null}
          {activeGroups.map((group) => {
            const got = group.items.reduce((sum, item) => sum + (scores[item.key] ?? 0), 0);
            return (
              <fieldset key={group.id} className="group" disabled={!scoreReady}>
                <div className="group-head">
                  <h2>
                    {group.title}
                    <span className="muted"> （满分{group.max}）</span>
                  </h2>
                  <span className="muted">
                    {got}/{group.max}
                  </span>
                </div>
                {group.hint ? <p className="hint">标准：{group.hint}</p> : null}
                {group.items.map((item) => (
                  <div key={item.key} className="item">
                    <h3>
                      {item.label}
                      <span className="muted"> （满分{item.max}）</span>
                    </h3>
                    {item.standard ? <p className="standard">标准：{item.standard}</p> : null}
                    <div className="choices" role="radiogroup" aria-label={item.label}>
                      {item.choices.map((choice) => {
                        const on = scores[item.key] === choice.value;
                        return (
                          <label
                            key={choice.value}
                            className="choice"
                            data-on={on ? "true" : "false"}
                            data-testid={`choice-${item.key}-${choice.value}`}
                          >
                            <input
                              type="radio"
                              name={item.key}
                              checked={on}
                              onChange={() =>
                                setScores((current) => ({ ...current, [item.key]: choice.value as ScoreMap[ItemKey] }))
                              }
                            />
                            {choice.label}
                            <small>{choice.value}分</small>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </fieldset>
            );
          })}
          {error ? <p className="error">{error}</p> : null}
        </section>
      ) : null}

      {phase === "done" && active ? (
        <section className="card result">
          <p className="note" data-testid="result-note">
            已提交，可返回修改
          </p>
          <p className="muted">{active.name}</p>
          <p className="score" data-testid="result-total">
            {resultTotal}
            <span> / {TOTAL_MAX}</span>
          </p>
          <div className="stack" style={{ marginTop: 18 }}>
            <button className="btn" type="button" data-testid="back-to-edit" onClick={() => setPhase("score")}>
              返回修改
            </button>
            <button
              className="btn secondary"
              type="button"
              data-testid="back-to-list"
              onClick={() => void openList(hallKey, judgeName, "list")}
            >
              选择其他答辩人
            </button>
          </div>
        </section>
      ) : null}

      {phase === "score" && active ? (
        <div className="dock">
          <div className="dock-inner">
            <p className="live">
              已选 {picked}/10
              <b data-testid="live-total">
                {live}
                <span> / {TOTAL_MAX}</span>
              </b>
            </p>
            <button
              className="btn"
              type="button"
              data-testid="submit-score"
              disabled={!complete || !scoreReady || submitting}
              onClick={() => {
                if (existing) setConfirming(true);
                else void submit();
              }}
            >
              {existing ? "更新评分" : "提交评分"}
            </button>
          </div>
        </div>
      ) : null}

      {confirming ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="overwrite-title">
          <div className="modal-card">
            <h2 id="overwrite-title">覆盖之前的评分？</h2>
            <p>
              你已为「{active?.name}」提交过评分。确认后将改成当前这组成绩。
            </p>
            <div className="row-actions">
              <button className="btn ghost" type="button" data-testid="confirm-cancel" onClick={() => setConfirming(false)}>
                取消
              </button>
              <button className="btn" type="button" data-testid="confirm-overwrite" disabled={submitting} onClick={() => void submit()}>
                确认更新
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
