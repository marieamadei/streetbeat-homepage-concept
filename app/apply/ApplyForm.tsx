"use client";

import { FormEvent, useState } from "react";

export function ApplyForm() {
  const [submitted, setSubmitted] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="form-success" role="status">
        <span>Concept flow complete</span>
        <h2>Thank you.</h2>
        <p>
          This working prototype does not send or store information. In the live
          site, this is where Streetbeat would confirm the application and the
          next review step.
        </p>
        <button className="button" onClick={() => setSubmitted(false)}>Review the form again</button>
      </div>
    );
  }

  return (
    <form className="apply-form" onSubmit={submit}>
      <div className="form-note">
        Prototype only · this form does not transmit or store information.
      </div>
      <label>
        Your name
        <input name="name" autoComplete="name" required />
      </label>
      <label>
        Work email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Organization
        <input name="organization" autoComplete="organization" required />
      </label>
      <label>
        Sector
        <select name="sector" required defaultValue="">
          <option value="" disabled>Select one</option>
          <option>Nonprofits & NGOs</option>
          <option>Biotech & Life Sciences</option>
          <option>Consumer Goods</option>
          <option>Another sector</option>
        </select>
      </label>
      <label className="form-wide">
        What workflow or decision would you like to improve?
        <textarea name="workflow" rows={5} required />
      </label>
      <label className="form-wide">
        What measurable outcome would make the work valuable?
        <textarea name="outcome" rows={4} required />
      </label>
      <button className="button form-submit" type="submit">Preview application</button>
    </form>
  );
}
