interface Props {
  title?: string;
}

/**
 * Custom titlebar that fills the area behind the macOS traffic lights.
 * The whole strip is the OS drag region; the inner pill is `no-drag`.
 */
export function Titlebar({ title }: Props) {
  return (
    <div className="titlebar" data-tauri-drag-region>
      {title ? <span className="titlebar-name">{title}</span> : null}
    </div>
  );
}
