import type { NDAFormData } from "./NDAForm";

interface NDAPreviewProps {
  data: NDAFormData;
}

export default function NDAPreview({ data }: NDAPreviewProps) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "[Date]";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getTermLabel = (term: "1year" | "continues") => {
    return term === "1year" ? "1 year(s)" : "continues until terminated";
  };

  const getConfidentialityLabel = (term: "1year" | "perpetuity") => {
    return term === "1year"
      ? "1 year(s) from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws"
      : "in perpetuity";
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <section className="p-6">
        <h1 className="text-xl font-bold text-center mb-4 text-gray-900">
          Mutual Non-Disclosure Agreement
        </h1>

        <div className="mb-4">
          <h2 className="text-base font-semibold mb-1 text-gray-900">USING THIS MUTUAL NON-DISCLOSURE AGREEMENT</h2>
          <p className="text-sm text-gray-600">
            This Mutual Non-Disclosure Agreement (the &quot;MNDA&quot;) consists of: (1) this Cover Page (&quot;Cover Page&quot;) and (2) the Common Paper Mutual NDA Standard Terms Version 1.0. Any modifications of the Standard Terms should be made on the Cover Page, which will control over conflicts with the Standard Terms.
          </p>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <h3 className="font-semibold text-gray-900">Purpose</h3>
            <p className="text-gray-700">{data.purpose || "[Purpose]"}</p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">Effective Date</h3>
            <p className="text-gray-700">{formatDate(data.effectiveDate)}</p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">MNDA Term</h3>
            <p className="text-gray-700">
              Expires {getTermLabel(data.ndaTerm)} from Effective Date.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">Term of Confidentiality</h3>
            <p className="text-gray-700">
              {getConfidentialityLabel(data.termOfConfidentiality)}
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">Governing Law & Jurisdiction</h3>
            <p className="text-gray-700">
              Governing Law: {data.governingLaw || "[State]"}
            </p>
            <p className="text-gray-700">
              Jurisdiction: {data.jurisdiction || "[Location]"}
            </p>
          </div>

          {data.modifications && (
            <div>
              <h3 className="font-semibold text-gray-900">MNDA Modifications</h3>
              <p className="text-gray-700">{data.modifications}</p>
            </div>
          )}

          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-2">
              By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">PARTY 1</h3>
                <div className="space-y-1 text-xs text-gray-700">
                  <p><strong>Signature:</strong> {data.party1.signature || "________________"}</p>
                  <p><strong>Print Name:</strong> {data.party1.printName || "[Name]"}</p>
                  <p><strong>Title:</strong> {data.party1.title || "[Title]"}</p>
                  <p><strong>Company:</strong> {data.party1.company || "[Company]"}</p>
                  <p><strong>Notice Address:</strong> {data.party1.noticeAddress || "[Address]"}</p>
                  <p><strong>Date:</strong> {formatDate(data.party1.date)}</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">PARTY 2</h3>
                <div className="space-y-1 text-xs text-gray-700">
                  <p><strong>Signature:</strong> {data.party2.signature || "________________"}</p>
                  <p><strong>Print Name:</strong> {data.party2.printName || "[Name]"}</p>
                  <p><strong>Title:</strong> {data.party2.title || "[Title]"}</p>
                  <p><strong>Company:</strong> {data.party2.company || "[Company]"}</p>
                  <p><strong>Notice Address:</strong> {data.party2.noticeAddress || "[Address]"}</p>
                  <p><strong>Date:</strong> {formatDate(data.party2.date)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="p-6">
        <h1 className="text-xl font-bold mb-4 text-gray-900">Standard Terms</h1>

        <div className="space-y-3 text-xs text-gray-700">
          <div>
            <h3 className="font-semibold text-gray-900">1. Introduction</h3>
            <p>
              This Mutual Non-Disclosure Agreement (which incorporates these Standard Terms and the Cover Page) (&quot;MNDA&quot;) allows each party (&quot;Disclosing Party&quot;) to disclose or make available information in connection with the Purpose.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">2. Use and Protection of Confidential Information</h3>
            <p>
              The Receiving Party shall: (a) use Confidential Information solely for the Purpose; (b) not disclose Confidential Information to third parties without the Disclosing Party&apos;s prior written approval; (c) protect Confidential Information using at least a reasonable standard of care.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">3. Exceptions</h3>
            <p>
              The Receiving Party&apos;s obligations do not apply to information that: (a) is publicly available; (b) it rightfully knew prior to receipt; (c) it rightfully obtained from a third party; (d) it independently developed.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">4. Disclosures Required by Law</h3>
            <p>
              The Receiving Party may disclose Confidential Information to the extent required by law, provided it provides reasonable advance notice.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">5. Term and Termination</h3>
            <p>
              This MNDA expires at the end of the MNDA Term. Either party may terminate upon written notice. Obligations survive for the Term of Confidentiality.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">6. Return or Destruction of Confidential Information</h3>
            <p>
              Upon expiration or request, the Receiving Party will destroy or return all Confidential Information.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">7. Proprietary Rights</h3>
            <p>
              The Disclosing Party retains all intellectual property rights in its Confidential Information.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">8. Disclaimer</h3>
            <p>
              ALL CONFIDENTIAL INFORMATION IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">9. Governing Law and Jurisdiction</h3>
            <p>
              governed by the laws of {data.governingLaw || "[State]"}. Any suit must be in {data.jurisdiction || "[Location]"}.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">10. Equitable Relief</h3>
            <p>
              A breach may cause irreparable harm for which monetary damages are insufficient.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900">11. General</h3>
            <p>
              Neither party may assign this MNDA without prior written consent.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}