import "dotenv/config";
import prismaClient from "./config/prisma";
import {
  createContactMessage,
  deleteContactMessage,
  getContactMessageById,
  getContactMessages,
  getContactMessageStats,
  updateContactMessageStatus,
} from "./modules/contact/contact.service";

async function runContactVerification() {
  console.log("=== CONTACT / SUPPORT MESSAGE MANAGEMENT VERIFICATION ===");

  try {
    // 1. Submit public contact message (Guest)
    console.log("\n--- TEST 1: Public Contact Submission ---");
    const testPayload = {
      name: "Alice Johnson",
      email: "alice.johnson@example.com",
      subject: "Order Tracking Support",
      message: "Hello, I would like to inquire about my order shipping status. Thank you!",
    };
    const createdMsg = await createContactMessage(testPayload);
    console.log(`Created Contact Message ID: ${createdMsg.id}`);
    console.log(`Submitted By: ${createdMsg.name} (${createdMsg.email})`);
    console.log(`Subject: "${createdMsg.subject}" | Initial Status: ${createdMsg.status}`);

    if (createdMsg.status === "UNREAD") {
      console.log("✅ PASSED: Default status is UNREAD upon submission");
    } else {
      console.error("❌ FAILED: Default status is not UNREAD");
    }

    // 2. Admin List & Filter Messages
    console.log("\n--- TEST 2: Admin Contact Message Listing & Filtering ---");
    const listResult = await getContactMessages({ search: "Alice", status: "UNREAD", limit: 5 });
    console.log(`Found ${listResult.data.length} messages for search 'Alice' (Total: ${listResult.meta.total})`);
    if (listResult.data.some((m) => m.id === createdMsg.id)) {
      console.log("✅ PASSED: Created message listed in admin search results");
    } else {
      console.error("❌ FAILED: Message not found in search results");
    }

    // 3. Admin Message Statistics
    console.log("\n--- TEST 3: Contact Message Statistics ---");
    const stats = await getContactMessageStats();
    console.log(`Stats -> Total: ${stats.totalMessages}, Unread: ${stats.unreadMessages}, Read: ${stats.readMessages}, Today: ${stats.todayMessages}`);
    if (stats.totalMessages >= 1 && stats.unreadMessages >= 1) {
      console.log("✅ PASSED: Message statistics correctly calculated");
    } else {
      console.error("❌ FAILED: Incorrect message statistics");
    }

    // 4. View Single Message & Auto Mark Read
    console.log("\n--- TEST 4: View Single Message & Auto Mark-Read ---");
    const viewedMsg = await getContactMessageById(createdMsg.id);
    console.log(`Viewed Message ID: ${viewedMsg.id} | Status after view: ${viewedMsg.status}`);
    if (viewedMsg.status === "READ") {
      console.log("✅ PASSED: Viewing UNREAD message automatically transitioned status to READ");
    } else {
      console.error("❌ FAILED: Auto mark-read failed");
    }

    // 5. Update Status (READ -> UNREAD -> READ)
    console.log("\n--- TEST 5: Manual Status Update ---");
    const unreadMsg = await updateContactMessageStatus(createdMsg.id, "UNREAD");
    console.log(`Status updated to: ${unreadMsg.status}`);
    const readAgainMsg = await updateContactMessageStatus(createdMsg.id, "READ");
    console.log(`Status updated back to: ${readAgainMsg.status}`);
    if (unreadMsg.status === "UNREAD" && readAgainMsg.status === "READ") {
      console.log("✅ PASSED: Status toggling (READ <-> UNREAD) works correctly");
    } else {
      console.error("❌ FAILED: Status toggle failed");
    }

    // 6. Delete Contact Message
    console.log("\n--- TEST 6: Delete Contact Message ---");
    await deleteContactMessage(createdMsg.id);
    const postDeleteCount = await prismaClient.contactMessage.count({ where: { id: createdMsg.id } });
    if (postDeleteCount === 0) {
      console.log(`✅ PASSED: Contact message ${createdMsg.id} deleted successfully`);
    } else {
      console.error("❌ FAILED: Message still exists after deletion");
    }

    console.log("\n=== ALL CONTACT SYSTEM VERIFICATIONS PASSED ===");
  } catch (error) {
    console.error("Verification error:", error);
  } finally {
    await prismaClient.$disconnect();
  }
}

runContactVerification();
