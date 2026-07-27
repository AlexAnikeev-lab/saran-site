'use strict';

const express = require('express');
const ctrl = require('./progress.controller');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', ctrl.getProgress);
router.put('/', ctrl.saveProgress);
router.post('/merge', ctrl.mergeProgress);

module.exports = router;
