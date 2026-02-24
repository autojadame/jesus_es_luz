// src/pages/Dashboard/DashboardPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import type { BibleItem } from "@/types/bible";

import { discardId, updateText } from "@/features/settings/settingsSlice";
import { fetchSummaries } from "@/features/llm/thunks";
import { Button } from "@/ui/components/Button";
import { Loader } from "@/ui/components/Loader";
import { TextArea } from "@/ui/components/Field";
import { useNavigate, Navigate } from "react-router-dom";
import {
  Wrap,
  TopGrid,
  Featured,
  TextBox,
  Grid,
  SmallCard,
  BottomBar,
  IndexBadge,
} from "./Dashboard.styles";

import { BATCH_SIZE } from "@/constants/app";
import { addLineBreaksAfterDotUpper } from "@/utils/textFormat";
import { setProcessBatch } from "@/features/llm/llmSlice";

export function DashboardPage() {
  const nav = useNavigate();
  const dispatch = useAppDispatch();

  // ✅ base data
  const items = useAppSelector((s) => s.settings.items) ?? [];
  const startIndex = useAppSelector((s) => s.settings.startIndex) ?? 0;
  const discardedIds = useAppSelector((s) => s.settings.discardedIds) ?? [];
  const historyEntries = useAppSelector((s) => s.history.entries) ?? [];

  // ✅ summaries
  const summariesById = useAppSelector((s) => s.llm.summariesById);
  const summariesLoading = useAppSelector((s) => s.llm.summariesLoading);
  const summariesError = useAppSelector((s) => s.llm.summariesError);

  // ✅ batch: filtra descartados + filtra los que ya tienen MP3 y SRT guardados
  const batch: BibleItem[] = useMemo(() => {
    const discarded = new Set(discardedIds);

    // map: por passageId si existe algún entry con mp3 y srt guardados
    const savedByPassage = new Map<number, { mp3: boolean; srt: boolean }>();
    for (const e of historyEntries as any[]) {
      const cur = savedByPassage.get(e.passageId) ?? { mp3: false, srt: false };
      if (e?.saved?.mp3) cur.mp3 = true;
      if (e?.saved?.srt) cur.srt = true;
      savedByPassage.set(e.passageId, cur);
    }

    const out: BibleItem[] = [];
    for (let i = Math.max(0, startIndex); i < items.length && out.length < BATCH_SIZE; i++) {
      const it = items[i];
      if (!it) continue;

      if (discarded.has(it.id)) continue;

      const saved = savedByPassage.get(it.id);
      const isComplete = !!saved?.mp3 && !!saved?.srt;
      if (isComplete) continue; // ✅ ya tiene MP3+SRT

      out.push(it);
    }

    return out;
  }, [items, startIndex, discardedIds.join(","), historyEntries, BATCH_SIZE]);

  // ✅ selección (featured dinámico)
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (!batch.length) {
      setSelectedId(null);
      return;
    }
    const exists = selectedId != null && batch.some((p) => p.id === selectedId);
    if (!exists) setSelectedId(batch[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch.map((x) => x.id).join(","), selectedId]);

  // ✅ genera summaries al entrar / cambiar batch
  useEffect(() => {
    if (batch.length) dispatch(fetchSummaries(batch));
  }, [dispatch, batch.map((x) => x.id).join(",")]);

  const selectedPassage = useMemo(() => {
    if (!batch.length) return undefined;
    if (selectedId == null) return batch[0];
    return batch.find((p) => p.id === selectedId) ?? batch[0];
  }, [batch, selectedId]);

  const featured = selectedPassage;

  const featuredIndex = useMemo(() => {
    if (!featured) return 1;
    const idx = batch.findIndex((p) => p.id === featured.id);
    return idx >= 0 ? idx + 1 : 1;
  }, [batch, featured?.id]);

  const featuredSummary = featured ? summariesById[featured.id] : undefined;

  const [expand, setExpand] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [textDraft, setTextDraft] = useState("");

  useEffect(() => {
    if (featured) setTextDraft(featured.texto);
    setEditMode(false);
  }, [featured?.id]);

  const allHaveSummaries = useMemo(
    () => batch.every((p) => summariesById[p.id]),
    [batch, summariesById]
  );

  // ✅ si hay proceso activo, vuelve a process
  const processBatchIds = useAppSelector((s) => s.llm.processBatchIds);
  const procStatusById = useAppSelector((s) => s.llm.songsStatusById) ?? {};

  const processActive =
    (processBatchIds?.length ?? 0) > 0 &&
    processBatchIds.some((id) => procStatusById[id] !== "done");

  if (processActive) {
    return <Navigate to="/process" replace />;
  }

  if (!batch.length) {
    return (
      <Wrap>
        <div style={{ opacity: 0.8 }}>
          No hay pasajes pendientes: los disponibles ya tienen MP3 y SRT (o están descartados). Ve a{" "}
          <b>Settings</b> para cargar más o a <b>Histórico</b>.
        </div>
      </Wrap>
    );
  }

  return (
    <Wrap>
      
        <div>
          <div style={{ fontWeight: 780, marginBottom: 10 }}>Pasajes del lote (click para seleccionar)</div>
          <Grid>
            {batch.map((p, idx) => {
              const s = summariesById[p.id];
              const selected = featured?.id === p.id;

              return (
                <SmallCard
                  key={p.id}
                  $selected={selected}
                  onClick={() => setSelectedId(p.id)}
                  title="Click para poner este pasaje arriba"
                  role="button"
                  aria-label={`Seleccionar pasaje ${idx + 1}`}
                >
                  <div className="top">
                    <IndexBadge>#{idx + 1}</IndexBadge>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{p.testamento}</div>
                  </div>

                  <div className="t">{s?.titulo ?? (summariesLoading ? "Cargando..." : "—")}</div>
                  <div className="d">{s?.descripcion ?? (summariesLoading ? "Generando..." : "—")}</div>

                  <div className="foot">
                    <span>
                      {p.libro} {p.capitulo}:{p.versiculo_inicial}-{p.versiculo_final}
                    </span>
                    <span>ID {p.id}</span>
                  </div>

                  <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                    <Button
                      $variant="danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch(discardId(p.id));
                      }}
                    >
                      Descartar
                    </Button>
                  </div>
                </SmallCard>
              );
            })}
          </Grid>
        </div>
        <div style={{ fontWeight: 780, marginTop: 10 }}>Detalles</div>
      <TopGrid>
        <Featured>
          <div className="head">
            <div className="leftHead">
              <IndexBadge>#{featuredIndex}</IndexBadge>
              <div style={{ minWidth: 0 }}>
                <div className="ref">
                  {featured?.libro} {featured?.capitulo}:{featured?.versiculo_inicial}-{featured?.versiculo_final}
                </div>
                <div className="meta">
                  Testamento: {featured?.testamento} • ID: {featured?.id}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {summariesLoading && <Loader />}
              {featured && (
                <Button $variant="danger" onClick={() => dispatch(discardId(featured.id))}>
                  Descartar
                </Button>
              )}
            </div>
          </div>

          <div className="title">
            {featuredSummary?.titulo ?? (summariesLoading ? "Generando título..." : "Sin título")}
          </div>
          <div className="desc">
            {featuredSummary?.descripcion ?? (summariesLoading ? "Generando descripción..." : "—")}
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button $variant="ghost" onClick={() => setExpand((v) => !v)}>
              {expand ? "Ocultar texto" : "Ver texto"}
            </Button>
            <Button $variant="ghost" onClick={() => setEditMode((v) => !v)}>
              {editMode ? "Cancelar edición" : "Editar texto"}
            </Button>
            {editMode && featured && (
              <Button
                $variant="primary"
                onClick={() => {
                  dispatch(updateText({ id: featured.id, texto: textDraft }));
                  setEditMode(false);
                }}
              >
                Guardar texto
              </Button>
            )}
          </div>

          {expand && featured && (
            <TextBox>
              {editMode ? (
                <TextArea value={textDraft} onChange={(e) => setTextDraft(e.target.value)} />
              ) : (
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.35, color: "rgba(255,255,255,0.80)" }}>
                  {addLineBreaksAfterDotUpper(featured.texto)}
                </div>
              )}
            </TextBox>
          )}

          {summariesError && (
            <div style={{ marginTop: 10, color: "rgba(255,77,109,0.95)", fontSize: 12 }}>
              Error summaries: {summariesError}
            </div>
          )}
        </Featured>

      </TopGrid>

      <div />

      <BottomBar>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {allHaveSummaries ? "Summaries listos." : "Faltan summaries..."}
        </div>
        <Button
          $variant="primary"
          disabled={!allHaveSummaries}
          onClick={() => {
            dispatch(setProcessBatch(batch.map((p) => p.id)));
            nav("/process");
          }}
        >
          Procesar (letras)
        </Button>
      </BottomBar>
    </Wrap>
  );
}