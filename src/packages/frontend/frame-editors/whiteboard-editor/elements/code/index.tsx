import { CSSProperties } from "react";
import { Element } from "../../types";
import ControlBar from "./control";
import Input from "./input";
import Output from "./output";

interface Props {
  element: Element;
  focused?: boolean;
}

export default function Code({ element, focused }: Props) {
  const style = {
    height: "100%",
    overflowY: "auto",
    fontSize: element.data?.fontSize,
    border: element.data?.radius
      ? `${2 * (element.data?.radius ?? 1)}px solid ${
          element.data?.color ?? "#ccc"
        }`
      : undefined,
    borderRadius: "5px",
    padding: "5px",
    background: "white",
  } as CSSProperties;

  const { hideInput, hideOutput } = element.data ?? {};

  return (
    <div className={focused ? "nodrag" : undefined} style={style}>
      {!hideInput && <Input element={element} focused={focused} />}
      {!hideOutput && element.data?.output && <Output element={element} />}
      {/* hideInput && (hideOutput || !element.data?.output) && (
        <Icon name="jupyter" />
      )*/}
      {focused && <ControlBar element={element} />}
    </div>
  );
}
