const Contact = require("../Models/ContactModel");

// CREATE a new contact message
const createContact = async (req, res) => {
  try {
    const { firstName, lastName, email, telephone, message } = req.body;

    // Basic validation
    if (!firstName || !lastName || !email || !telephone || !message) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    const contact = new Contact({ firstName, lastName, email, telephone, message });
    await contact.save();

    res.status(201).json({ success: true, message: "Message sent successfully!", data: contact });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error.", error: error.message });
  }
};

// GET all contact messages
const getContacts = async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: contacts });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error.", error: error.message });
  }
};

// GET single contact message by ID
// const getContactById = async (req, res) => {
//   try {
//     const contact = await Contact.findById(req.params.id);
//     if (!contact) {
//       return res.status(404).json({ success: false, message: "Contact not found." });
//     }
//     res.status(200).json({ success: true, data: contact });
//   } catch (error) {
//     res.status(500).json({ success: false, message: "Server error.", error: error.message });
//   }
// };

// DELETE a contact message by ID
const deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.query.id);
    if (!contact) {
      return res.status(404).json({ success: false, message: "Contact not found." });
    }
    res.status(200).json({ success: true, message: "Contact deleted successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error.", error: error.message });
  }
};

module.exports = {
  createContact,
  getContacts,
  deleteContact
}