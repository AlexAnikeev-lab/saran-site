'use strict';

const service = require('./progress.service');
const { asyncHandler } = require('../../utils/asyncHandler');
const { validate, progressSchema } = require('../../utils/validators');

const getProgress = asyncHandler(async (req, res) => {
  const progress = service.getProgress(req.user.id);
  res.json({ progress });
});

const saveProgress = asyncHandler(async (req, res) => {
  const data = validate(progressSchema, req.body);
  const progress = service.saveProgress(req.user.id, data);
  res.json({ progress });
});

const mergeProgress = asyncHandler(async (req, res) => {
  const data = validate(progressSchema, req.body);
  const progress = service.mergeProgress(req.user.id, data);
  res.json({ progress });
});

module.exports = { getProgress, saveProgress, mergeProgress };
