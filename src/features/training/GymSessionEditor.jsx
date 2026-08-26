import React from "react";
import { SessionEditorBase } from "./SessionEditorBase";

export function GymSessionEditor(props) {
  return <SessionEditorBase {...props} type="GYM" className="training-gym-session-editor" />;
}
