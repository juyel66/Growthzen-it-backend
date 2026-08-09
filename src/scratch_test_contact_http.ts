async function testContactApi() {
  console.log("--- TEST 1: Valid Contact Submission ---");
  const payload = {
    name: "Test User",
    email: "test@example.com",
    subject: "Test Message",
    message: "This is a test contact message.",
  };

  const response = await fetch("http://localhost:5000/api/v1/contact/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const status = response.status;
  const data = await response.json();

  console.log(`HTTP Status: ${status}`);
  console.log("API Response Body:", JSON.stringify(data, null, 2));

  console.log("\n--- TEST 2: Validation Error Output Test (Invalid Email) ---");
  const invalidPayload = {
    name: "Test User",
    email: "not-an-email",
    message: "Short",
  };

  const errResponse = await fetch("http://localhost:5000/api/v1/contact/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(invalidPayload),
  });

  const errStatus = errResponse.status;
  const errData = await errResponse.json();

  console.log(`HTTP Status: ${errStatus}`);
  console.log("API Error Response Body:", JSON.stringify(errData, null, 2));
}

testContactApi();
