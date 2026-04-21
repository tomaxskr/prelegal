"use client";

import { useState } from "react";
import NDAForm, { NDAFormData, getEmptyFormData } from "@/components/NDAForm";
import NDAPreview from "@/components/NDAPreview";
import jsPDF from "jspdf";

export default function Home() {
  const [formData, setFormData] = useState<NDAFormData>(getEmptyFormData());

  const handleFormChange = (data: NDAFormData) => {
    setFormData(data);
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;
    let y = 20;

    const addText = (text: string, fontSize = 10, isBold = false, spacing = 5) => {
      const lines = doc.splitTextToSize(text, maxWidth);
      lines.forEach((line: string) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.text(line, margin, y);
        y += spacing + fontSize / 4;
      });
    };

    const addHeading = (text: string) => {
      addText(text, 14, true, 5);
      y += 3;
    };

    const addSubheading = (text: string) => {
      addText(text, 11, true, 4);
    };

    addHeading("Mutual Non-Disclosure Agreement");

    addText(
      "This Mutual Non-Disclosure Agreement (the 'MNDA') consists of: (1) this Cover Page ('Cover Page') and (2) the Common Paper Mutual NDA Standard Terms Version 1.0.",
      9
    );
    y += 5;

    addSubheading("Purpose");
    addText(formData.purpose || "[Purpose]");
    y += 5;

    addSubheading("Effective Date");
    addText(formatDate(formData.effectiveDate));
    y += 5;

    addSubheading("MNDA Term");
    addText(
      formData.ndaTerm === "1year"
        ? "Expires 1 year(s) from Effective Date"
        : "Continues until terminated"
    );
    y += 5;

    addSubheading("Term of Confidentiality");
    addText(
      formData.termOfConfidentiality === "1year"
        ? "1 year(s) from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret"
        : "In perpetuity"
    );
    y += 5;

    addSubheading("Governing Law & Jurisdiction");
    addText(`Governing Law: ${formData.governingLaw || "[State]"}`);
    addText(`Jurisdiction: ${formData.jurisdiction || "[Location]"}`);
    y += 5;

    if (formData.modifications) {
      addSubheading("MNDA Modifications");
      addText(formData.modifications);
      y += 5;
    }

    addText("By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.", 9);
    y += 10;

    const colWidth = (maxWidth - 10) / 2;
    const leftCol = margin;
    const rightCol = margin + colWidth + 10;
    let yLeft = y;
    let yRight = y;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("PARTY 1", leftCol, yLeft);
    doc.text("PARTY 2", rightCol, yRight);
    yLeft += 6;
    yRight += 6;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Signature:", leftCol, yLeft);
    doc.text("Signature:", rightCol, yRight);
    yLeft += 5;
    yRight += 5;
    doc.setFont("helvetica", "normal");
    doc.text(formData.party1.signature || "________________", leftCol, yLeft);
    doc.text(formData.party2.signature || "________________", rightCol, yRight);
    yLeft += 5;
    yRight += 5;

    doc.setFont("helvetica", "bold");
    doc.text("Print Name:", leftCol, yLeft);
    doc.text("Print Name:", rightCol, yRight);
    yLeft += 5;
    yRight += 5;
    doc.setFont("helvetica", "normal");
    doc.text(formData.party1.printName || "[Name]", leftCol, yLeft);
    doc.text(formData.party2.printName || "[Name]", rightCol, yRight);
    yLeft += 5;
    yRight += 5;

    doc.setFont("helvetica", "bold");
    doc.text("Title:", leftCol, yLeft);
    doc.text("Title:", rightCol, yRight);
    yLeft += 5;
    yRight += 5;
    doc.setFont("helvetica", "normal");
    doc.text(formData.party1.title || "[Title]", leftCol, yLeft);
    doc.text(formData.party2.title || "[Title]", rightCol, yRight);
    yLeft += 5;
    yRight += 5;

    doc.setFont("helvetica", "bold");
    doc.text("Company:", leftCol, yLeft);
    doc.text("Company:", rightCol, yRight);
    yLeft += 5;
    yRight += 5;
    doc.setFont("helvetica", "normal");
    doc.text(formData.party1.company || "[Company]", leftCol, yLeft);
    doc.text(formData.party2.company || "[Company]", rightCol, yRight);
    yLeft += 5;
    yRight += 5;

    doc.setFont("helvetica", "bold");
    doc.text("Notice Address:", leftCol, yLeft);
    doc.text("Notice Address:", rightCol, yRight);
    yLeft += 5;
    yRight += 5;
    doc.setFont("helvetica", "normal");
    doc.text(formData.party1.noticeAddress || "[Address]", leftCol, yLeft);
    doc.text(formData.party2.noticeAddress || "[Address]", rightCol, yRight);
    yLeft += 5;
    yRight += 5;

    doc.setFont("helvetica", "bold");
    doc.text("Date:", leftCol, yLeft);
    doc.text("Date:", rightCol, yRight);
    yLeft += 5;
    yRight += 5;
    doc.setFont("helvetica", "normal");
    doc.text(formatDate(formData.party1.date), leftCol, yLeft);
    doc.text(formatDate(formData.party2.date), rightCol, yRight);

    y = Math.max(yLeft, yRight) + 10;

    doc.addPage();
    y = 20;

    addHeading("Standard Terms");

    const terms = [
      {
        title: "1. Introduction",
        text: "This Mutual Non-Disclosure Agreement (which incorporates these Standard Terms and the Cover Page) ('MNDA') allows each party ('Disclosing Party') to disclose or make available information in connection with the Purpose which (1) the Disclosing Party identifies as 'confidential', 'proprietary', or the like or (2) should be reasonably understood as confidential or proprietary due to its nature ('Confidential Information').",
      },
      {
        title: "2. Use and Protection of Confidential Information",
        text: "The Receiving Party shall: (a) use Confidential Information solely for the Purpose; (b) not disclose Confidential Information to third parties without the Disclosing Party's prior written approval; (c) protect Confidential Information using at least a reasonable standard of care.",
      },
      {
        title: "3. Exceptions",
        text: "The Receiving Party's obligations do not apply to information that: (a) is publicly available; (b) it rightfully knew prior to receipt; (c) it rightfully obtained from a third party; (d) it independently developed.",
      },
      {
        title: "4. Disclosures Required by Law",
        text: "The Receiving Party may disclose Confidential Information to the extent required by law, provided it provides reasonable advance notice.",
      },
      {
        title: "5. Term and Termination",
        text: "This MNDA expires at the end of the MNDA Term. Either party may terminate upon written notice. Obligations survive for the Term of Confidentiality.",
      },
      {
        title: "6. Return or Destruction of Confidential Information",
        text: "Upon expiration or request, the Receiving Party will destroy or return all Confidential Information.",
      },
      {
        title: "7. Proprietary Rights",
        text: "The Disclosing Party retains all intellectual property rights in its Confidential Information.",
      },
      {
        title: "8. Disclaimer",
        text: "ALL CONFIDENTIAL INFORMATION IS PROVIDED 'AS IS' WITHOUT WARRANTIES.",
      },
      {
        title: "9. Governing Law and Jurisdiction",
        text: `Governed by the laws of ${formData.governingLaw || "[State]"}. Any suit must be in ${formData.jurisdiction || "[Location]"}.`,
      },
      {
        title: "10. Equitable Relief",
        text: "A breach may cause irreparable harm for which monetary damages are insufficient.",
      },
      {
        title: "11. General",
        text: "Neither party may assign this MNDA without prior written consent.",
      },
    ];

    terms.forEach((term) => {
      addSubheading(term.title);
      addText(term.text);
      y += 3;
    });

    addText("Common Paper Mutual Non-Disclosure Agreement (Version 1.0) free to use under CC BY 4.0.", 8);

    doc.save(`mutual-nda-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  return (
    <main className="min-h-screen bg-gray-100 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">
            Mutual NDA Creator
          </h1>
          <p className="text-gray-600 text-sm">
            Fill in the form and see your document update in real-time
          </p>
        </header>

        <div className="lg:grid lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow h-fit">
            <NDAForm formData={formData} onChange={handleFormChange} />
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Document Preview</h2>
              <button
                onClick={handleDownloadPdf}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium text-sm"
              >
                Download PDF
              </button>
            </div>
            <div className="bg-white border border-gray-200 rounded">
              <NDAPreview data={formData} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "[Date]";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}