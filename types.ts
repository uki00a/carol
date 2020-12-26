export interface AppOptions {
  icon?: string;
  top?: number;
  left?: number;
  width?: number;
  height?: number;
  bgcolor?: string;
  localDataDir?: string;
  userDataDir?: string;

  /**
   * Window title
   */
  title?: string;
  args?: string[];
  paramsForReuse?: unknown;
}
