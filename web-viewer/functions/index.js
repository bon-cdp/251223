const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });

// DashScope (Qwen) API configuration
const DASHSCOPE_API_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";
const DASHSCOPE_API_KEY = "sk-3154176795dd40969654a6efb517ab0a";

/**
 * Process PDF text through Qwen LLM to extract structured real estate data
 */
exports.processPdfText = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const { text } = req.body;

    if (!text) {
      res.status(400).json({ error: "No text provided" });
      return;
    }

    const instructions = `Extract structured real estate development information from the following text.
Return a JSON object with these keys:
- properties: object with property details (apn, area_sf, dimensions, etc.)
- constraints: object with regulatory constraints (zoning, height, setbacks, parking, far)
- units: array of dwelling unit types if found (type, count, area_sf)
- metadata: object with any other relevant info

Focus on numerical values and regulatory requirements.`;

    const payload = {
      model: "qwen-plus",
      messages: [
        {
          role: "system",
          content: "You are a real estate data extraction assistant. Extract structured data from property documents. Always return valid JSON.",
        },
        {
          role: "user",
          content: `${instructions}\n\nDOCUMENT TEXT:\n${text}\n\nReturn ONLY valid JSON, no other text.`,
        },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    };

    try {
      const response = await fetch(DASHSCOPE_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${DASHSCOPE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("DashScope API error:", errorText);
        res.status(500).json({ error: "LLM API error", details: errorText });
        return;
      }

      const result = await response.json();
      const content = result.choices[0].message.content;

      // Try to parse JSON from response
      let extractedData;
      try {
        // Find JSON in response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]);
        } else {
          extractedData = { raw_response: content, parsing_failed: true };
        }
      } catch (parseError) {
        extractedData = { raw_response: content, parsing_failed: true };
      }

      res.json({
        success: true,
        data: extractedData,
        model: "qwen-plus",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error processing:", error);
      res.status(500).json({ error: "Processing failed", details: error.message });
    }
  });
});
