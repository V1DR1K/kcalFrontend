import React from "react";
import { ModalShell } from "../../components/dialog/ModalShell";
import { SkeletonRows } from "../../components/Loading";
import { CatalogStatus } from "../catalog/CatalogComponents";
import { NutritionCollectionPreview } from "./NutritionCollectionPreview";

export function CollectionDetailDialog({ title, preview, loading = false, error, onRetry, onClose, returnFocusRef, footer, actions }) {
  return <ModalShell title={title} onClose={onClose} returnFocusRef={returnFocusRef} className="collection-detail-dialog" backdropClassName="collection-detail-backdrop" footer={footer}>
    {loading ? <SkeletonRows count={4} label={`Cargando ${title}`} /> : error ? <CatalogStatus error>{error}<button type="button" className="secondary" onClick={onRetry}>Reintentar</button></CatalogStatus> : <NutritionCollectionPreview {...preview} showTitle={false} actions={actions} />}
  </ModalShell>;
}
