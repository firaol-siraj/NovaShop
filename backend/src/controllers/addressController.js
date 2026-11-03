import Address from '../models/addressModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { sanitizePhoneNumber } from '../utils/phone.js';

// @desc    Get all saved addresses for current user
// @route   GET /api/v1/addresses
// @access  Private
export const getAddresses = asyncHandler(async (req, res, next) => {
  const addresses = await Address.find({ user: req.user._id }).sort({ isDefault: -1, createdAt: -1 });
  res.status(200).json({
    success: true,
    count: addresses.length,
    data: addresses,
  });
});

// @desc    Get single address by ID
// @route   GET /api/v1/addresses/:id
// @access  Private
export const getAddressById = asyncHandler(async (req, res, next) => {
  const address = await Address.findById(req.params.id);

  if (!address) {
    return next(new ApiError(404, 'Address not found'));
  }

  if (address.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new ApiError(403, 'Not authorized to view this address'));
  }

  res.status(200).json({
    success: true,
    data: address,
  });
});

// @desc    Create a new saved address
// @route   POST /api/v1/addresses
// @access  Private
export const createAddress = asyncHandler(async (req, res, next) => {
  const {
    label,
    type,
    firstName,
    lastName,
    phone,
    street,
    street2,
    city,
    state,
    postalCode,
    country,
    isDefault,
  } = req.body;

  if (!firstName || !lastName || !phone || !street || !city) {
    return next(new ApiError(400, 'Please provide first name, last name, phone, street, and city'));
  }

  // Count existing addresses for user
  const existingCount = await Address.countDocuments({ user: req.user._id });
  const shouldBeDefault = Boolean(isDefault || existingCount === 0);

  if (shouldBeDefault) {
    await Address.updateMany({ user: req.user._id }, { isDefault: false });
  }

  const address = await Address.create({
    user: req.user._id,
    label: label || 'Home',
    type: type || 'home',
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    phone: sanitizePhoneNumber(String(phone).trim()),
    street: String(street).trim(),
    street2: String(street2 || '').trim(),
    city: String(city || 'Addis Ababa').trim(),
    state: String(state || 'Addis Ababa').trim(),
    postalCode: String(postalCode || '1000').trim(),
    country: String(country || 'Ethiopia').trim(),
    isDefault: shouldBeDefault,
  });

  res.status(201).json({
    success: true,
    message: 'Address saved successfully',
    data: address,
  });
});

// @desc    Update a saved address
// @route   PATCH /api/v1/addresses/:id
// @access  Private
export const updateAddress = asyncHandler(async (req, res, next) => {
  const address = await Address.findById(req.params.id);

  if (!address) {
    return next(new ApiError(404, 'Address not found'));
  }

  if (address.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new ApiError(403, 'Not authorized to update this address'));
  }

  const {
    label,
    type,
    firstName,
    lastName,
    phone,
    street,
    street2,
    city,
    state,
    postalCode,
    country,
    isDefault,
  } = req.body;

  if (isDefault === true && !address.isDefault) {
    await Address.updateMany(
      { user: req.user._id, _id: { $ne: address._id } },
      { isDefault: false }
    );
    address.isDefault = true;
  }

  if (label !== undefined) address.label = String(label).trim();
  if (type !== undefined) address.type = String(type).trim();
  if (firstName !== undefined) address.firstName = String(firstName).trim();
  if (lastName !== undefined) address.lastName = String(lastName).trim();
  if (phone !== undefined) address.phone = sanitizePhoneNumber(String(phone).trim());
  if (street !== undefined) address.street = String(street).trim();
  if (street2 !== undefined) address.street2 = String(street2 || '').trim();
  if (city !== undefined) address.city = String(city).trim();
  if (state !== undefined) address.state = String(state).trim();
  if (postalCode !== undefined) address.postalCode = String(postalCode).trim();
  if (country !== undefined) address.country = String(country).trim();

  const updatedAddress = await address.save();

  res.status(200).json({
    success: true,
    message: 'Address updated successfully',
    data: updatedAddress,
  });
});

// @desc    Delete a saved address
// @route   DELETE /api/v1/addresses/:id
// @access  Private
export const deleteAddress = asyncHandler(async (req, res, next) => {
  const address = await Address.findById(req.params.id);

  if (!address) {
    return next(new ApiError(404, 'Address not found'));
  }

  if (address.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new ApiError(403, 'Not authorized to delete this address'));
  }

  const wasDefault = address.isDefault;
  await address.deleteOne();

  // If deleted address was default, promote another address to default if one exists
  if (wasDefault) {
    const nextAddress = await Address.findOne({ user: req.user._id }).sort({ createdAt: -1 });
    if (nextAddress) {
      nextAddress.isDefault = true;
      await nextAddress.save();
    }
  }

  res.status(200).json({
    success: true,
    message: 'Address removed successfully',
  });
});

// @desc    Set an address as default
// @route   PATCH /api/v1/addresses/:id/set-default
// @access  Private
export const setDefaultAddress = asyncHandler(async (req, res, next) => {
  const address = await Address.findById(req.params.id);

  if (!address) {
    return next(new ApiError(404, 'Address not found'));
  }

  if (address.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new ApiError(403, 'Not authorized to modify this address'));
  }

  // Unset all other defaults for user
  await Address.updateMany(
    { user: req.user._id },
    { isDefault: false }
  );

  address.isDefault = true;
  await address.save();

  res.status(200).json({
    success: true,
    message: 'Default address updated successfully',
    data: address,
  });
});
