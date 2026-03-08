# Google Apps Script Deployment Guide

## Setup Steps

1.  Open your Google Sheet: `1sUlcMjOWy4ZS_4yI7It6cnsj3hU60PLDYdhQvWMPPl4`
2.  Click **Extensions** > **Apps Script**.
3.  Create 4 files in the script editor:
    *   `Config.gs`
    *   `Database.gs`
    *   `Service.gs`
    *   `Main.gs`
4.  Copy and paste the content from the files in this folder into the corresponding files in the script editor.

## Deployment

1.  In the Apps Script editor, click **Deploy** > **New deployment**.
2.  Click the gear icon next to "Select type" and choose **Web app**.
3.  Configure as follows:
    *   **Description**: `v1`
    *   **Execute as**: `Me` (your account)
    *   **Who has access**: `Anyone` (Recommended for simplest frontend integration, or `Anyone with Google account` if you want auth).
4.  Click **Deploy**.
5.  Copy the **Web App URL**. You will use this URL in your frontend React application to send data.

## API Usage

**Endpoint**: `YOUR_WEB_APP_URL`
**Method**: `POST`

**Example Payload for Saving:**
```json
{
  "action": "SAVE_CONFIG",
  "payload": {
     "academicYear": "113",
     "semester": "上",
     "courseName": "阿美語",
     "instructorName": "王小明",
     "classTime": "週一 09:00",
     "location": "教室A",
     "students": [
       { "id": "1", "period": "1", "className": "101", "name": "張三" }
     ]
  }
}
```
