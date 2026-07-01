import { CSSProperties, InputHTMLAttributes } from "react";

export interface InputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onSubmit" | "style"
> {
  placeholder?: string;
  /** Lime button label. Pass empty/undefined for a plain bordered input. */
  buttonLabel?: string;
  onSubmit?: (value: string) => void;
  style?: CSSProperties;
}

export function Input(props: InputProps): JSX.Element;
