import { FormDataSchema, formDataType } from "../server/validateFormData.ts";

export function initFormData(data: formDataType<FormDataSchema>): FormData {
  const formData = new FormData();
  for (const [fieldName, fieldValue] of Object.entries(data)) {
    if ((fieldValue as any) instanceof Blob) {
      formData.set(fieldName, fieldValue);
    } else if (typeof fieldValue == "object" && fieldValue != null) {
      const jsonBlob = new Blob([JSON.stringify(fieldValue)], {
        type: "application/json",
      });
      formData.set(fieldName, jsonBlob);
    } else if (typeof fieldValue == "string" || typeof fieldValue == "number") {
      formData.set(fieldName, String(fieldValue));
    }
  }
  return formData;
}
