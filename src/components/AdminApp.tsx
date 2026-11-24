"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { normalizeName } from "@/lib/names";
import { GROUPS, ITEM_LIST } from "@/lib/rubric";
import type { ResultCard } from "@/lib/results";
import { formatAverage, formatTrimmed } from "@/lib/stats";
import { formatShanghai } from "@/lib/time";
import { Header } from "./Header";

type Phase = "loading" | "setup" | "login" | "app";
type Tab = "entry" | "people" | "scores";
type Candidate = { id: string; name: string; archived: boolean; sortOrder: number };

export function AdminApp() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [tab, setTab] = useState<Tab>("entry");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hallKey, setHallKey] = useState("");
  const [origin, setOrigin] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [results, setResults] = useState<ResultCard[]>([]);
  const [draft, setDraft] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    setOrigin(window.location.origin);
    void refreshStatus();
  }, []);

  const link = origin && hallKey ? `${origin}/?k=${encodeURIComponent(hallKey)}` : "";

  useEffect(() => {
    if (!link) return;
    let cancel = false;
    void import("qrcode").then(async (QR) => {
      const data = await QR.toDataURL(link, { margin: 1, width: 560, errorCorrectionLevel: "M" });
      if (!cancel) setQr(data);
    });
    return () => {
      cancel = true;
    };
  }, [link]);

  async function refreshStatus() {
    try {
      const status = await api<{ needsSetup: boolean; authenticated: boolean }>("/api/admin/status");
      if (status.needsSetup) {
        setPhase("setup");
        return;
      }
      if (status.authenticated) {
        await loadOverview();
        return;
      }
      setPhase("login");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "暂时无法连接");
      setPhase("login");
    }
  }

  async function loadOverview() {
    const data = await api<{ hallKey: string; candidates: Candidate[]; results: ResultCard[] }>("/api/admin/overview");
    setHallKey(data.hallKey);
    setCandidates(data.candidates);
    setResults(data.results);
    const next: Record<string, string> = {};
    for (const candidate of data.candidates) next[candidate.id] = candidate.name;
    setNames(next);
    setPhase("app");
  }

  async function setup(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 6 || password.trim().length < 6) {
      setError("密码至少 6 位");
      return;
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setBusy(true);
    try {
      await api("/api/admin/setup", { method: "POST", body: { password } });
      setPassword("");
      setConfirm("");
      await loadOverview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "设置失败");
    } finally {
      setBusy(false);
    }
  }

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/api/admin/login", { method: "POST", body: { password } });
      setPassword("");
      await loadOverview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await api("/api/admin/logout", { method: "POST", body: {} });
    setHallKey("");
    setPhase("login");
  }

  async function addCandidate(event: React.FormEvent) {
    event.preventDefault();
    const name = normalizeName(draft);
    if (!name) {
      setError("请填写答辩人姓名");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/candidates", { method: "POST", body: { name } });
      setDraft("");
      await loadOverview();
      setTab("people");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "添加失败");
    } finally {
      setBusy(false);
    }
  }

  async function saveCandidate(candidate: Candidate, archived?: boolean) {
    const name = normalizeName(names[candidate.id] ?? "");
    if (!name) {
      setError("请填写答辩人姓名");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/candidates", {
        method: "PATCH",
        body: archived === undefined ? { id: candidate.id, name } : { id: candidate.id, name, archived },
      });
      await loadOverview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="screen wide">
      <Header sub="组织者管理" />
      {phase === "loading" ? <p className="muted">正在打开…</p> : null}

      {phase === "setup" ? (
        <form className="card stack" onSubmit={setup}>
          <h2>设置管理员密码</h2>
          <p className="muted">首次进入会把密码写入数据库。之后打开本页需要这组密码，请牢记。密码不是写在程序里的固定口令。</p>
          <label className="field">
            密码
            <input
              data-testid="admin-password"
              type="password"
              value={password}
              autoComplete="new-password"
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <label className="field">
            再次输入
            <input
              data-testid="admin-password-2"
              type="password"
              value={confirm}
              autoComplete="new-password"
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
          </label>
          {error ? (
            <p className="error" data-testid="admin-error">
              {error}
            </p>
          ) : null}
          <button className="btn" data-testid="admin-setup" type="submit" disabled={busy}>
            设置并进入
          </button>
        </form>
      ) : null}

      {phase === "login" ? (
        <form className="card stack" onSubmit={login}>
          <h2>管理员登录</h2>
          <label className="field">
            密码
            <input
              data-testid="admin-password"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error ? (
            <p className="error" data-testid="admin-error">
              {error}
            </p>
          ) : null}
          <button className="btn" data-testid="admin-login" type="submit" disabled={busy}>
            进入
          </button>
        </form>
      ) : null}

      {phase === "app" ? (
        <>
          <div className="tabs">
            <button type="button" data-testid="tab-entry" data-on={tab === "entry"} onClick={() => setTab("entry")}>
              会场入口
            </button>
            <button type="button" data-testid="tab-people" data-on={tab === "people"} onClick={() => setTab("people")}>
              答辩人
            </button>
            <button type="button" data-testid="tab-scores" data-on={tab === "scores"} onClick={() => setTab("scores")}>
              成绩
            </button>
          </div>
          {error ? <p className="error">{error}</p> : null}

          {tab === "entry" ? (
            <section className="card stack">
              <h2>评委会场二维码</h2>
              <p className="muted">评委用微信扫这个码即可打分，不需要 Cursor 账号。请把这个入口发给评委，不要把管理页发给评委。</p>
              {qr ? <img className="qr" data-testid="qr-image" src={qr} alt="会场评分二维码" /> : <p className="muted">正在生成二维码…</p>}
              <label className="field">
                会场链接
                <textarea data-testid="hall-link" readOnly rows={3} value={link} onFocus={(event) => event.currentTarget.select()} />
              </label>
              <button className="btn" type="button" data-testid="copy-link" onClick={() => void copyLink()}>
                {copied ? "已复制" : "复制会场链接"}
              </button>
              <a className="btn secondary" href={link || "/"}>
                打开评委入口
              </a>
              <button className="btn ghost" type="button" onClick={() => void logout()}>
                退出管理
              </button>
            </section>
          ) : null}

          {tab === "people" ? (
            <section>
              <form className="card stack" onSubmit={addCandidate}>
                <h2>添加答辩人</h2>
                <label className="field">
                  姓名
                  <input
                    data-testid="candidate-name-input"
                    value={draft}
                    maxLength={40}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                </label>
                <button className="btn" data-testid="candidate-add" type="submit" disabled={busy}>
                  添加答辩人
                </button>
              </form>
              {candidates.filter((item) => !item.archived).length === 0 ? (
                <p className="card" data-testid="admin-empty">
                  还没有答辩人。请先添加，评委端才会出现名单。
                </p>
              ) : null}
              {candidates
                .filter((item) => !item.archived)
                .map((candidate) => (
                  <article key={candidate.id} className="card" data-testid="candidate-row" data-name={candidate.name}>
                    <div className="candidate-edit">
                      <input
                        aria-label={`${candidate.name}的姓名`}
                        value={names[candidate.id] ?? ""}
                        maxLength={40}
                        onChange={(event) => setNames((current) => ({ ...current, [candidate.id]: event.target.value }))}
                      />
                      <button className="btn small" type="button" disabled={busy} onClick={() => void saveCandidate(candidate)}>
                        改名
                      </button>
                      <button
                        className="btn small secondary"
                        type="button"
                        data-testid={`archive-${candidate.name}`}
                        disabled={busy}
                        onClick={() => void saveCandidate(candidate, true)}
                      >
                        隐藏
                      </button>
                    </div>
                  </article>
                ))}
              {candidates.some((item) => item.archived) ? <h2 className="section-title">已隐藏</h2> : null}
              {candidates
                .filter((item) => item.archived)
                .map((candidate) => (
                  <article key={candidate.id} className="card" data-name={candidate.name}>
                    <div className="candidate-edit">
                      <input
                        aria-label={`${candidate.name}的姓名`}
                        value={names[candidate.id] ?? ""}
                        maxLength={40}
                        onChange={(event) => setNames((current) => ({ ...current, [candidate.id]: event.target.value }))}
                      />
                      <button
                        className="btn small"
                        type="button"
                        data-testid={`restore-${candidate.name}`}
                        disabled={busy}
                        onClick={() => void saveCandidate(candidate, false)}
                      >
                        恢复
                      </button>
                    </div>
                  </article>
                ))}
            </section>
          ) : null}

          {tab === "scores" ? (
            <section>
              <div className="card stack">
                <h2>成绩汇总</h2>
                <p className="muted">
                  A 全部评委平均。B 去掉一个最高分和一个最低分再平均；少于 3 位评委时 B 为人数不足，不显示数字。按 A 排名。
                </p>
                <a className="btn" data-testid="export-link" href="/api/admin/export">
                  导出 Excel
                </a>
              </div>
              {results.length === 0 ? <p className="card">还没有答辩人。</p> : null}
              {results.map((card) => (
                <article key={card.id} className="card" data-testid="result-card" data-name={card.name}>
                  <h2>
                    {card.rank ? `第${card.rank}名 ` : ""}
                    {card.name}
                    {card.archived ? <span className="tag">已隐藏</span> : null}
                  </h2>
                  <p className="muted" data-testid={`judge-count-${card.name}`}>
                    {card.judgeCount} 位评委
                  </p>
                  <div className="ab">
                    <article>
                      <span>A 全部评委平均</span>
                      <strong data-testid={`total-a-${card.name}`}>{formatAverage(card.total.a)}</strong>
                    </article>
                    <article>
                      <span>B 去最高最低再平均</span>
                      <strong
                        className={card.judgeCount < 3 ? "text" : undefined}
                        data-testid={`total-b-${card.name}`}
                      >
                        {formatTrimmed(card.total.b, card.judgeCount)}
                      </strong>
                    </article>
                  </div>
                  <h3>分组小计</h3>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>分组</th>
                          <th>满分</th>
                          <th>A</th>
                          <th>B</th>
                        </tr>
                      </thead>
                      <tbody>
                        {GROUPS.map((group) => (
                          <tr key={group.id}>
                            <td>{group.title}</td>
                            <td>{group.max}</td>
                            <td data-testid={`group-a-${card.name}-${group.id}`}>{formatAverage(card.groups[group.id].a)}</td>
                            <td data-testid={`group-b-${card.name}-${group.id}`}>
                              {formatTrimmed(card.groups[group.id].b, card.judgeCount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <h3>十项得分</h3>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>项目</th>
                          <th>A</th>
                          <th>B</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ITEM_LIST.map((item) => (
                          <tr key={item.key}>
                            <td>{item.short}</td>
                            <td data-testid={`item-a-${card.name}-${item.key}`}>{formatAverage(card.items[item.key].a)}</td>
                            <td data-testid={`item-b-${card.name}-${item.key}`}>
                              {formatTrimmed(card.items[item.key].b, card.judgeCount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <h3>评委明细</h3>
                  {card.judges.length === 0 ? <p className="muted">还没有评委提交。</p> : null}
                  {card.judges.length > 0 ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>评委</th>
                            {ITEM_LIST.map((item) => (
                              <th key={item.key}>{item.short}</th>
                            ))}
                            <th>总分</th>
                            <th>时间</th>
                          </tr>
                        </thead>
                        <tbody>
                          {card.judges.map((judge) => (
                            <tr key={judge.judgeName} data-testid={`judge-row-${card.name}-${judge.judgeName}`}>
                              <td>{judge.judgeName}</td>
                              {ITEM_LIST.map((item) => (
                                <td key={item.key}>{judge.scores[item.key]}</td>
                              ))}
                              <td>{judge.total}</td>
                              <td>{formatShanghai(judge.updatedAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </article>
              ))}
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
