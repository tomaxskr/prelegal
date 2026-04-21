"use client";

import { useState } from "react";

export interface NDAFormData {
  purpose: string;
  effectiveDate: string;
  ndaTerm: "1year" | "continues";
  termOfConfidentiality: "1year" | "perpetuity";
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  party1: {
    signature: string;
    printName: string;
    title: string;
    company: string;
    noticeAddress: string;
    date: string;
  };
  party2: {
    signature: string;
    printName: string;
    title: string;
    company: string;
    noticeAddress: string;
    date: string;
  };
}

export const getEmptyFormData = (): NDAFormData => ({
  purpose: "",
  effectiveDate: new Date().toISOString().split("T")[0],
  ndaTerm: "1year",
  termOfConfidentiality: "1year",
  governingLaw: "",
  jurisdiction: "",
  modifications: "",
  party1: {
    signature: "",
    printName: "",
    title: "",
    company: "",
    noticeAddress: "",
    date: "",
  },
  party2: {
    signature: "",
    printName: "",
    title: "",
    company: "",
    noticeAddress: "",
    date: "",
  },
});

interface NDAFormProps {
  formData: NDAFormData;
  onChange: (data: NDAFormData) => void;
}

export default function NDAForm({ formData, onChange }: NDAFormProps) {
  const handleChange = (
    section: keyof NDAFormData,
    field: keyof NDAFormData["party1"] | "",
    value: string
  ) => {
    if (section === "party1" || section === "party2") {
      onChange({
        ...formData,
        [section]: {
          ...formData[section as "party1" | "party2"],
          [field]: value,
        },
      });
    } else {
      onChange({ ...formData, [section]: value });
    }
  };

  return (
    <form className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Purpose</h2>
        <textarea
          value={formData.purpose}
          onChange={(e) => handleChange("purpose", "", e.target.value)}
          placeholder="How Confidential Information may be used"
          className="w-full p-3 border border-gray-300 rounded-md h-20 text-gray-900"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Term</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date</label>
            <input
              type="date"
              value={formData.effectiveDate}
              onChange={(e) => handleChange("effectiveDate", "", e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">MNDA Term</label>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-gray-700">
                <input
                  type="radio"
                  name="ndaTerm"
                  checked={formData.ndaTerm === "1year"}
                  onChange={() => handleChange("ndaTerm", "", "1year")}
                />
                Expires 1 year(s) from Effective Date
              </label>
              <label className="flex items-center gap-2 text-gray-700">
                <input
                  type="radio"
                  name="ndaTerm"
                  checked={formData.ndaTerm === "continues"}
                  onChange={() => handleChange("ndaTerm", "", "continues")}
                />
                Continues until terminated
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Term of Confidentiality</label>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-gray-700">
                <input
                  type="radio"
                  name="termOfConfidentiality"
                  checked={formData.termOfConfidentiality === "1year"}
                  onChange={() => handleChange("termOfConfidentiality", "", "1year")}
                />
                1 year(s) from Effective Date, but in the case of trade secrets
              </label>
              <label className="flex items-center gap-2 text-gray-700">
                <input
                  type="radio"
                  name="termOfConfidentiality"
                  checked={formData.termOfConfidentiality === "perpetuity"}
                  onChange={() => handleChange("termOfConfidentiality", "", "perpetuity")}
                />
                In perpetuity
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Governing Law & Jurisdiction</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Governing Law (State)</label>
            <input
              type="text"
              value={formData.governingLaw}
              onChange={(e) => handleChange("governingLaw", "", e.target.value)}
              placeholder="e.g., Delaware"
              className="w-full p-3 border border-gray-300 rounded-md text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jurisdiction</label>
            <input
              type="text"
              value={formData.jurisdiction}
              onChange={(e) => handleChange("jurisdiction", "", e.target.value)}
              placeholder="e.g., courts located in Wilmington, DE"
              className="w-full p-3 border border-gray-300 rounded-md text-gray-900"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">MNDA Modifications</h2>
        <textarea
          value={formData.modifications}
          onChange={(e) => handleChange("modifications", "", e.target.value)}
          placeholder="List any modifications to the MNDA"
          className="w-full p-3 border border-gray-300 rounded-md h-20 text-gray-900"
        />
      </section>

      {(["party1", "party2"] as const).map((party) => (
        <section key={party} className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">
            {party === "party1" ? "Party 1" : "Party 2"}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Signature</label>
              <input
                type="text"
                value={formData[party].signature}
                onChange={(e) => handleChange(party, "signature", e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Print Name</label>
              <input
                type="text"
                value={formData[party].printName}
                onChange={(e) => handleChange(party, "printName", e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={formData[party].title}
                onChange={(e) => handleChange(party, "title", e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <input
                type="text"
                value={formData[party].company}
                onChange={(e) => handleChange(party, "company", e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md text-gray-900"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notice Address</label>
              <input
                type="text"
                value={formData[party].noticeAddress}
                onChange={(e) => handleChange(party, "noticeAddress", e.target.value)}
                placeholder="Email or postal address"
                className="w-full p-3 border border-gray-300 rounded-md text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={formData[party].date}
                onChange={(e) => handleChange(party, "date", e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md text-gray-900"
              />
            </div>
          </div>
        </section>
      ))}
    </form>
  );
}