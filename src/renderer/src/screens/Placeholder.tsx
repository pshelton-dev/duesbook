export default function Placeholder({ name }: { name: string }): React.JSX.Element {
  return (
    <div>
      <h1>{name}</h1>
      <div className="panel">Coming soon — see SCREEN-MAP.md for what belongs here.</div>
    </div>
  )
}
