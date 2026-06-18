"use client";

/**
 * Hidden honeypot input for bot friction on the public email forms. Real users
 * never see or fill it (it's pulled off-screen and skipped by the tab order); a
 * bot that fills every field trips the server-side `honeypotTripped` check,
 * which returns a silent success and writes nothing. Wire `value` into the POST
 * body as `company`.
 */
export function HoneypotField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", left: "-9999px", top: "-9999px", height: 0, width: 0, overflow: "hidden" }}
    >
      <label>
        Company
        <input
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}
