const BACKEND_URL =
  "https://material-dad-petty.ngrok-free.dev/scan";

export const scanImage = async (
  imageUri: string
) => {

  const formData = new FormData();

  formData.append("file", {
    uri: imageUri,
    name: "scan.jpg",
    type: "image/jpeg",
  } as any);

  const controller =
    new AbortController();

  const timeout =
    setTimeout(() => {
      controller.abort();
    }, 120000);

  try {

    const response = await fetch(
      BACKEND_URL,
      {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type":
            "multipart/form-data",
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {

      throw new Error(
        "Server failed to process request"
      );
    }

    const data =
      await response.json();

    return data;

  } catch (error: any) {

    clearTimeout(timeout);

    if (error.name === "AbortError") {

      console.log(
        "Request timeout or cancelled"
      );

      return {
        analysis: {
          severity: "medium",
          risk_score: 0,
          summary:
            "Request timed out. Please try again.",
        },
      };
    }

    console.error("API Error:", error);

    throw error;
  }
};