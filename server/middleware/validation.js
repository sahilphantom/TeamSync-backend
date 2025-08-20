const Joi = require('joi');

// User validation schemas
const registerValidation = (data) => {
  const schema = Joi.object({
    username: Joi.string().min(3).max(20).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
  });

  return schema.validate(data);
};

const loginValidation = (data) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  });

  return schema.validate(data);
};

// Workspace validation
const workspaceValidation = (data) => {
  const schema = Joi.object({
    name: Joi.string().max(50).required(),
    description: Joi.string().max(200).allow('')
  });

  return schema.validate(data);
};

// Channel validation
const channelValidation = (data) => {
  const schema = Joi.object({
    name: Joi.string().max(50).required(),
    description: Joi.string().max(200).allow(''),
    isPrivate: Joi.boolean()
  });

  return schema.validate(data);
};

// Message validation
const messageValidation = (data) => {
  const schema = Joi.object({
    content: Joi.string().max(5000).required(),
    channel: Joi.string().when('isDirect', {
      is: false,
      then: Joi.required()
    }),
    recipient: Joi.string().when('isDirect', {
      is: true,
      then: Joi.required()
    }),
    isDirect: Joi.boolean(),
    thread: Joi.string().allow('')
  });

  return schema.validate(data);
};

module.exports = {
  registerValidation,
  loginValidation,
  workspaceValidation,
  channelValidation,
  messageValidation
};