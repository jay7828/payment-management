const express = require("express");
const { listSites, createSite, updateSite, deleteSite } = require("../controllers/siteController");

const router = express.Router();

router.get("/", listSites);
router.post("/", createSite);
router.patch("/:siteId", updateSite);
router.delete("/:siteId", deleteSite);

module.exports = router;
