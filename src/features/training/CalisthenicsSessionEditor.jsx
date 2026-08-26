import React from "react";
import { SessionEditorBase } from "./SessionEditorBase";

export function CalisthenicsSessionEditor(props) {
  return <SessionEditorBase {...props} type="CALISTHENICS" className="training-calisthenics-session-editor" />;
}
