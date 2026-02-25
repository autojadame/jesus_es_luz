import React, { useMemo, useRef, useState, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { selectDiscardedIds, selectItems, selectStartIndex } from "@/features/settings/selectors";
import { clearDiscardedIds, restoreId, setItems, setStartIndex } from "@/features/settings/settingsSlice";
import { validateBibleJson } from "@/features/settings/validators";
import { Button } from "@/ui/components/Button";
import { Input, Label } from "@/ui/components/Field";
import {
  Wrap,
  Panel,
  Title,
  Sub,
  Row,
  Pill,
  StatGrid,
  StatBox,
  StatLabel,
  StatValue,
  NasDot,
  ListHeader,
  DiscardList,
  DiscardItem,
  DiscardTitle,
  DiscardMeta,
} from "./Settings.styles";

function asTrimmedString(x: any) {
  return typeof x === "string" ? x.trim() : "";
}

function hasMp3(e: any) {
  return !!asTrimmedString(e?.saved?.mp3?.path);
}
function hasSrt(e: any) {
  return !!asTrimmedString(e?.saved?.srt?.path);
}

function passageRef(it: any) {
  if (!it) return "";
  return `${it.libro} ${it.capitulo}:${it.versiculo_inicial}-${it.versiculo_final}`;
}

export function SettingsPage() {
  const dispatch = useAppDispatch();

  // ✅ settings existentes (NO cambiamos el slice)
  const items = useAppSelector(selectItems);
  const startIndex = useAppSelector(selectStartIndex);
  const discardedIds = useAppSelector(selectDiscardedIds);

  // ✅ histórico canciones
  const historyEntries = useAppSelector((s: any) => s.history.entries) as any[];

  // -------------------------
  // JSON load (sin textarea)
  // -------------------------
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [jsonStatus, setJsonStatus] = useState<
    | { ok: true; fileName: string; count: number }
    | { ok: false; fileName?: string; error: string }
    | null
  >(null);

  const [idxRaw, setIdxRaw] = useState(String(startIndex));
  const idxNum = Number(idxRaw);
  const idxOk = Number.isInteger(idxNum) && idxNum >= 0 && idxNum < Math.max(1, items.length);

  // -------------------------
  // NAS (por IPC en Electron)
  // -------------------------
  const [nasRoot, setNasRoot] = useState<string>("\\\\192.168.1.143\\Storage");
  const [nasOk, setNasOk] = useState<boolean | null>(null); // null = unknown
  const [nasMsg, setNasMsg] = useState<string>("");

  const electronAPI = (window as any)?.electronAPI;

  const doNasCheck = async (root?: string) => {
    try {
      setNasOk(null);
      setNasMsg("");
      const res = await electronAPI?.nas?.check({ root: root ?? nasRoot });
      const ok = !!res?.ok;
      setNasOk(ok);
      setNasMsg(res?.message ? String(res.message) : ok ? "OK" : "Sin acceso");
    } catch (e: any) {
      setNasOk(false);
      setNasMsg(e?.message ?? "Error comprobando NAS");
    }
  };

  const doNasLoad = async () => {
    try {
      const res = await electronAPI?.nas?.getRoot();
      const root = (res?.root ? String(res.root) : "\\\\192.168.1.143\\Storage").trim();
      setNasRoot(root || "\\\\192.168.1.143\\Storage");
      await doNasCheck(root);
    } catch {
      // fallback silencioso
      setNasRoot("\\\\192.168.1.143\\Storage");
      await doNasCheck("\\\\192.168.1.143\\Storage");
    }
  };

  useEffect(() => {
    // carga config real + check
    if (electronAPI?.nas) doNasLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doNasSave = async () => {
    try {
      const root = String(nasRoot ?? "").trim();
      const res = await electronAPI?.nas?.setRoot({ root });
      const saved = (res?.root ? String(res.root) : root).trim();
      setNasRoot(saved);
      await doNasCheck(saved);
    } catch (e: any) {
      setNasOk(false);
      setNasMsg(e?.message ?? "Error guardando ruta NAS");
    }
  };

  // -------------------------
  // Stats canciones
  // -------------------------
  const stats = useMemo(() => {
    const all = Array.isArray(historyEntries) ? historyEntries : [];

    const total = all.length;
    const withTitle = all.filter((e) => !!asTrimmedString(e?.songTitulo)).length;
    const withLyrics = all.filter((e) => !!asTrimmedString(e?.songLetra)).length;

    // "str" en tu texto parece ser "srt" (subtítulos)
    const withSrtCount = all.filter((e) => hasSrt(e)).length;
    const withMp3Count = all.filter((e) => hasMp3(e)).length;

    const withAll = all.filter(
      (e) =>
        !!asTrimmedString(e?.songTitulo) &&
        !!asTrimmedString(e?.songLetra) &&
        hasSrt(e) &&
        hasMp3(e)
    ).length;

    const discarded = discardedIds.length;

    return {
      total,
      withTitle,
      withLyrics,
      withSrtCount,
      withMp3Count,
      withAll,
      discarded,
    };
  }, [historyEntries, discardedIds]);

  // -------------------------
  // Lista descartes (derecha)
  // -------------------------
  const discardList = useMemo(() => {
    const byId = new Map<number, any>();
    for (const it of items) byId.set(it.id, it);

    // history.entries se guarda newest-first => el primero por passageId será el “latest”
    const latestByPassage = new Map<number, any>();
    for (const h of historyEntries ?? []) {
      const pid = Number(h?.passageId);
      if (!Number.isFinite(pid)) continue;
      if (!latestByPassage.has(pid)) latestByPassage.set(pid, h);
    }

    return discardedIds.map((id) => {
      const pid = Number(id);
      const latest = latestByPassage.get(pid);
      const it = byId.get(pid);

      const title =
        asTrimmedString(latest?.songTitulo) ||
        asTrimmedString(latest?.summaryTitulo) ||
        passageRef(it) ||
        "(sin título)";

      return {
        id: pid,
        title,
      };
    });
  }, [discardedIds, items, historyEntries]);

  // -------------------------
  // Handlers
  // -------------------------
  const pickJson = () => fileRef.current?.click();

  const onJsonFile = async (file: File | null) => {
    if (!file) return;

    try {
      const raw = await file.text();
      const v = validateBibleJson(raw);

      if (!v.ok) {
        setJsonStatus({ ok: false, fileName: file.name, error: v.error });
        return;
      }

      dispatch(setItems(v.items));
      // startIndex lo dejas como esté (setItems ya clamp), pero guardamos el input si procede:
      if (Number.isInteger(idxNum) && idxNum >= 0) dispatch(setStartIndex(Math.max(0, idxNum)));
      // al cargar un JSON nuevo, normalmente quieres limpiar descartes
      dispatch(clearDiscardedIds());

      setJsonStatus({ ok: true, fileName: file.name, count: v.items.length });
    } catch (e: any) {
      setJsonStatus({ ok: false, fileName: file?.name, error: e?.message ?? "No se pudo leer el JSON" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Wrap>
      {/* IZQUIERDA */}
      <Panel>
        <Title>Settings</Title>
        <Sub>
          Carga el JSON desde archivo (no se muestra), revisa stats de canciones, conexión NAS, y gestiona descartes.
        </Sub>

        {/* Cargar JSON */}
        <Row>
          <Button $variant="primary" onClick={pickJson}>
            Cargar JSON
          </Button>

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={(e) => onJsonFile(e.target.files?.[0] ?? null)}
          />

          <Pill $tone="warn">Items actuales: {items.length}</Pill>

          {jsonStatus?.ok ? (
            <Pill $tone="ok">
              JSON OK ({jsonStatus.count} items) — {jsonStatus.fileName}
            </Pill>
          ) : jsonStatus ? (
            <Pill $tone="bad">
              JSON inválido{jsonStatus.fileName ? ` — ${jsonStatus.fileName}` : ""}: {jsonStatus.error}
            </Pill>
          ) : null}
        </Row>

        <div style={{ height: 12 }} />

        {/* startIndex (lo mantengo porque ya existía y es útil) */}
        <Label>Índice inicial (startIndex)</Label>
        <Row>
          <div style={{ width: 160 }}>
            <Input value={idxRaw} onChange={(e) => setIdxRaw(e.target.value)} />
          </div>
          <Pill $tone={idxOk ? "ok" : "warn"}>{idxOk ? "OK" : "Fuera de rango (o no entero)"}</Pill>
          <Button
            disabled={!idxOk}
            onClick={() => {
              if (!idxOk) return;
              dispatch(setStartIndex(Math.max(0, idxNum)));
            }}
          >
            Guardar startIndex
          </Button>
        </Row>

        <div style={{ height: 16 }} />

        {/* STATS */}
        <Title style={{ fontSize: 14, marginBottom: 10 }}>Stats</Title>
        <StatGrid>
          <StatBox>
            <StatLabel>Total canciones (history)</StatLabel>
            <StatValue>{stats.total}</StatValue>
          </StatBox>

          <StatBox>
            <StatLabel>Procesadas (título)</StatLabel>
            <StatValue>{stats.withTitle}</StatValue>
          </StatBox>

          <StatBox>
            <StatLabel>Generadas (letra)</StatLabel>
            <StatValue>{stats.withLyrics}</StatValue>
          </StatBox>

          <StatBox>
            <StatLabel>Con SRT</StatLabel>
            <StatValue>{stats.withSrtCount}</StatValue>
          </StatBox>

          <StatBox>
            <StatLabel>Con MP3</StatLabel>
            <StatValue>{stats.withMp3Count}</StatValue>
          </StatBox>

          <StatBox>
            <StatLabel>Con TODO</StatLabel>
            <StatValue>{stats.withAll}</StatValue>
          </StatBox>

          <StatBox>
            <StatLabel>Descartadas</StatLabel>
            <StatValue>{stats.discarded}</StatValue>
          </StatBox>
        </StatGrid>

        <div style={{ height: 18 }} />

        {/* NAS */}
        <Title style={{ fontSize: 14, marginBottom: 10 }}>NAS</Title>

        <Row>
          <NasDot $ok={nasOk} />
          <Sub style={{ marginBottom: 0 }}>
            {nasOk === null ? "Sin comprobar" : nasOk ? "Conectado" : "Sin conexión"}
            {nasMsg ? ` — ${nasMsg}` : ""}
          </Sub>
        </Row>

        <div style={{ height: 10 }} />

        <Label>Ruta NAS (root)</Label>
        <Row>
          <Input value={nasRoot} onChange={(e) => setNasRoot(e.target.value)} />
          <Button onClick={doNasSave}>Guardar ruta</Button>
          <Button onClick={() => doNasCheck()}>Comprobar</Button>
        </Row>

        <Sub style={{ marginTop: 8 }}>
          Por defecto: <code>\\\\192.168.1.143\\Storage</code>. Esta ruta se usa para construir la librería (ya no hardcodeada).
        </Sub>
      </Panel>

      {/* DERECHA */}
      <Panel>
        <ListHeader>
          <div>
            <Title>Descartes</Title>
            <Sub style={{ marginBottom: 0 }}>
              Lista de canciones/pasajes descartados. Hover rojo y click para quitar del descarte.
            </Sub>
          </div>

          <Button onClick={() => dispatch(clearDiscardedIds())}>Limpiar todos</Button>
        </ListHeader>

        <div style={{ height: 12 }} />

        <DiscardList>
          {discardList.length === 0 ? (
            <Sub>No hay descartes.</Sub>
          ) : (
            discardList.map((d) => (
              <DiscardItem key={d.id} onClick={() => dispatch(restoreId(d.id))}>
                <DiscardTitle>{d.title}</DiscardTitle>
                <DiscardMeta>ID: {d.id}</DiscardMeta>
              </DiscardItem>
            ))
          )}
        </DiscardList>
      </Panel>
    </Wrap>
  );
}