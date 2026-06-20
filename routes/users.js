const express = require('express');
const router = express.Router();
const User = require('../models/User');
const leetcodeService = require('../services/leetcodeService');
const githubService = require('../services/githubService');

/**
 * POST /api/users
 * Creates a new user in the system.
 * Body: { id, name, email } (id is optional Clerk User ID)
 */
router.post('/users', async (req, res) => {
  const { id, name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required fields.' });
  }

  try {
    const user = await User.create({ id, name, email });
    return res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user:', error.message);
    if (error.message.includes('unique constraint') || error.message.includes('already exists')) {
      return res.status(409).json({ error: 'A user with this email or ID already exists.' });
    }
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/users/:id/link-accounts
 * Links public LeetCode and/or GitHub usernames to a user account.
 * Body: { leetcodeUsername, githubUsername } (either can be null or omitted)
 */
router.post('/users/:id/link-accounts', async (req, res) => {
  const userId = req.params.id;
  const { leetcodeUsername, githubUsername } = req.body;

  try {
    // 1. Verify the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: `User with ID "${userId}" not found.` });
    }

    const updates = {};

    // 2. Validate LeetCode username if provided
    if (leetcodeUsername !== undefined && leetcodeUsername !== null && leetcodeUsername !== '') {
      try {
        await leetcodeService.validateUsername(leetcodeUsername);
        updates.leetcodeUsername = leetcodeUsername;
      } catch (err) {
        return res.status(400).json({ 
          error: `LeetCode validation failed: ${err.message}` 
        });
      }
    } else if (leetcodeUsername === null || leetcodeUsername === '') {
      updates.leetcodeUsername = null;
    }

    // 3. Validate GitHub username if provided
    if (githubUsername !== undefined && githubUsername !== null && githubUsername !== '') {
      try {
        await githubService.validateUsername(githubUsername);
        updates.githubUsername = githubUsername;
      } catch (err) {
        return res.status(400).json({ 
          error: `GitHub validation failed: ${err.message}` 
        });
      }
    } else if (githubUsername === null || githubUsername === '') {
      updates.githubUsername = null;
    }

    // 4. If no updates are specified, return existing user
    if (Object.keys(updates).length === 0) {
      return res.json(user);
    }

    // 5. Save updates to database
    const updatedUser = await User.update(userId, updates);
    return res.json(updatedUser);

  } catch (error) {
    console.error(`Error linking accounts for user ${userId}:`, error.message);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
