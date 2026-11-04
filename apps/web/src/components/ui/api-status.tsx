type ApiStatusProps = Readonly<
  { available: true; service: string } | { available: false; service?: never }
>;

export function ApiStatus(props: ApiStatusProps) {
  return (
    <p className="status" data-available={props.available} role="status">
      {props.available
        ? `API disponible: ${props.service}`
        : "La API no está disponible en este momento."}
    </p>
  );
}
