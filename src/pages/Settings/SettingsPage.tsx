import React, { useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { selectDiscardedIds, selectItems, selectStartIndex } from "@/features/settings/selectors";
import { clearDiscardedIds, setItems, setStartIndex } from "@/features/settings/settingsSlice";
import { validateBibleJson } from "@/features/settings/validators";
import { prettyJson } from "@/utils/json";
import { Button } from "@/ui/components/Button";
import { Input, Label, TextArea } from "@/ui/components/Field";
import { Wrap, Panel, Title, Sub, Row, Pill, PreviewList, PreviewItem } from "./Settings.styles";

export function SettingsPage() {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectItems);
  const startIndex = useAppSelector(selectStartIndex);

  const [raw, setRaw] = useState(() => (items.length ? prettyJson(items) : "[]"));
  const [idxRaw, setIdxRaw] = useState(String(startIndex));

  const validation = useMemo(() => validateBibleJson(raw), [raw]);
  const idxNum = Number(idxRaw);
  const idxOk = Number.isInteger(idxNum) && idxNum >= 0 && (validation.ok ? idxNum < validation.items.length : true);

  const canSave = validation.ok && idxOk;

  return (
    <Wrap>
      <Panel>
        <Title>Settings</Title>
        <Sub>Edita el JSON, valida estructura obligatoria y guarda. Ajusta el índice inicial del Dashboard.</Sub>

        <Row>
          <Pill $tone={validation.ok ? "ok" : "bad"}>
            {validation.ok ? `JSON OK (${validation.items.length} items)` : "JSON inválido"}
          </Pill>
          {!validation.ok && <Pill $tone="bad">{validation.error}</Pill>}
        </Row>

        <div style={{ height: 12 }} />

        <Label>Índice inicial (startIndex)</Label>
        <Row>
          <div style={{ width: 160 }}>
            <Input value={idxRaw} onChange={(e) => setIdxRaw(e.target.value)} />
          </div>
          <Pill $tone={idxOk ? "ok" : "warn"}>
            {idxOk ? "OK" : "Fuera de rango (o no entero)"}
          </Pill>
          <Button
            $variant="primary"
            disabled={!canSave}
            onClick={() => {
              if (!validation.ok) return;
              dispatch(setItems(validation.items));
              dispatch(setStartIndex(Math.max(0, idxNum)));
              dispatch(clearDiscardedIds());
            }}
          >
            Guardar
          </Button>
        </Row>

        <div style={{ height: 12 }} />

        <Label>JSON (array de pasajes)</Label>
        <TextArea value={raw} onChange={(e) => setRaw(e.target.value)} spellCheck={false} />
      </Panel>

      <Panel>
        <Title>Preview</Title>
        <Sub>Vista rápida de los primeros elementos (para comprobar que tiene buena pinta).</Sub>

        <PreviewList>
          {(validation.ok ? validation.items : items).slice(0, 30).map((p) => (
            <PreviewItem key={p.id}>
              <div className="top">
                <div className="ref">
                  {p.libro} {p.capitulo}:{p.versiculo_inicial}-{p.versiculo_final}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{p.testamento}</div>
              </div>
              <div className="t">{p.texto.slice(0, 120)}{p.texto.length > 120 ? "…" : ""}</div>
            </PreviewItem>
          ))}
        </PreviewList>
      </Panel>
    </Wrap>
  );
}