import "styled-components";
import type { AppTheme } from "./ui/theme";

declare module "styled-components" {
  export interface DefaultTheme extends AppTheme {}
}