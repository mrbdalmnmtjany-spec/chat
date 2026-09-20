const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");
const { searchUsers, addContact, updateProfile } = require("../controllers/userController");

const router = express.Router();

router.use(protect);

router.get("/search", searchUsers);
router.put("/contacts/:userId", addContact);
router.put("/profile", upload.single("avatar"), updateProfile);

module.exports = router;
