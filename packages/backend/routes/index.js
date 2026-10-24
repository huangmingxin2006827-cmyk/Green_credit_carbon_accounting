const express = require('express')
const multer = require('multer')
const uploadController = require('../controllers/uploadController')
const reportController = require('../controllers/reportController')
const suggestionController = require('../controllers/suggestionController')
const taskController = require('../controllers/taskController')
const chatController = require('../controllers/chatController')
const chatHistoryController = require('../controllers/chatHistoryController')
const authController = require('../controllers/authController')
const { requireAuth } = require('../middleware/auth')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } })
const router = express.Router()

router.post('/auth/login', authController.login)
router.post('/auth/register', authController.register)
router.get('/auth/me', requireAuth, authController.me)
router.post('/auth/change-password', requireAuth, authController.changePassword)

router.use(requireAuth)

router.post('/upload', upload.single('file'), uploadController.upload)

router.post('/report/generate', reportController.generate)
router.get('/report/latest', reportController.latest)
router.get('/report/:id', reportController.getOne)
router.patch('/report/:id', reportController.patchOne)
router.get('/report/:id/charts', reportController.charts)
router.get('/report/:id/export', reportController.exportOne)
router.post('/report/:reportId/question', chatController.question)

router.post('/suggestion/generate', suggestionController.generate)
router.get('/suggestion/latest', suggestionController.latest)
router.post('/suggestion/:id/action', suggestionController.action)

router.get('/tasks', taskController.list)
router.patch('/tasks/:id/status', taskController.patchStatus)
router.post('/tasks/:id/complete', taskController.complete)
router.patch('/tasks/:id/checklist', taskController.checklist)
router.delete('/tasks/:id', taskController.remove)

router.post('/chat', chatController.chat)
router.get('/chat/history', chatHistoryController.history)
router.put('/chat/history', chatHistoryController.save)
router.delete('/chat/history', chatHistoryController.clear)

module.exports = router
