import User from '../models/User.js';

// Get user profile
export const getProfile = async (req, res) => {
  console.log('\n👤 === GET PROFILE ENDPOINT ===');
  
  try {
    // req.user is set by verifyToken middleware
    const { uid, email } = req.user;
    
    console.log('📨 Profile request for:');
    console.log('   UID:', uid);
    console.log('   Email:', email);

    // Find user by firebaseUid
    let user = await User.findOne({ firebaseUid: uid });
    
    if (!user) {
      console.log('🔍 User not found by UID, trying email...');
      
      // Try to find by email and link
      user = await User.findOne({ email });
      
      if (user) {
        console.log('✅ Found user by email, linking firebaseUid');
        user.firebaseUid = uid;
        await user.save();
      } else {
        console.log('❌ User not found in database');
        console.log('   This means the user never completed registration/sync');
        
        // Auto-create user to fix the issue
        console.log('📝 Auto-creating user to fix state...');
        user = await User.create({
          firebaseUid: uid,
          email,
          name: req.user.name || email.split('@')[0],
          authProvider: 'google'
        });
        console.log('✅ User auto-created:', user._id);
      }
    }

    console.log('✅ Profile retrieved for:', user.email);
    console.log('');

    res.status(200).json({
      success: true,
      user: user.toJSON()
    });
  } catch (error) {
    console.error('❌ Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile'
    });
  }
};

// Update user profile
export const updateProfile = async (req, res) => {
  console.log('\n📝 === UPDATE PROFILE ENDPOINT ===');
  
  try {
    const { uid, email } = req.user;
    const { name, mobileNumber, address, state, country, pincode } = req.body;

    console.log('📨 Update profile for UID:', uid);
    console.log('📨 Updates:', { name, mobileNumber, address, state, country, pincode });

    // Build updates object
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (mobileNumber !== undefined) updates.mobileNumber = mobileNumber;
    if (address !== undefined) updates.address = address;
    if (state !== undefined) updates.state = state;
    if (country !== undefined) updates.country = country;
    if (pincode !== undefined) updates.pincode = pincode;

    // Validate name
    if (updates.name !== undefined && !updates.name.trim()) {
      console.log('❌ Name cannot be empty');
      return res.status(400).json({
        success: false,
        message: 'Name cannot be empty'
      });
    }

    // Find and update user
    let user = await User.findOneAndUpdate(
      { firebaseUid: uid },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!user) {
      console.log('🔍 User not found by UID, trying email...');
      
      // Try to find by email
      user = await User.findOne({ email });
      
      if (user) {
        // Link UID and apply updates
        user.firebaseUid = uid;
        Object.assign(user, updates);
        await user.save();
        console.log('✅ Found by email, linked UID and updated');
      } else {
        console.log('❌ User not found');
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
    }

    console.log('✅ Profile updated for:', user.email);
    console.log('');

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: user.toJSON()
    });
  } catch (error) {
    console.error('❌ Update profile error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0]
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
};
