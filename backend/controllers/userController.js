import validator from 'validator'
import bcrypt from 'bcrypt'
import userModel from '../models/userModel.js';
import jwt from 'jsonwebtoken'
import { v2 as cloudinary } from 'cloudinary'
import doctorModel from '../models/doctorModel.js';
import appointmentModel from '../models/appointmentModel.js';
import Stripe from 'stripe'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

//API to register user
const registerUser = async (req, res) => {
  try {

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.json({ success: false, message: "Missing Details" })
    }

    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: "Enter a valid email" })
    }

    if (password.length < 8) {
      res.json({ success: false, message: "Enter a strong password" })
    }

    //hash password
    const salt = await bcrypt.genSalt(11)
    const hashedPassword = await bcrypt.hash(password, salt)

    const userData = {
      name,
      email,
      password: hashedPassword,
    }

    const newUser = new userModel(userData)
    const user = await newUser.save()

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)

    res.json({ success: true, token })

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message })
  }
}

//API for user login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await userModel.findOne({ email })

    if (!user) {
      return res.json({ success: false, message: "User does not exist" })
    }

    const isMatch = await bcrypt.compare(password, user.password)

    if (isMatch) {
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)
      res.json({ success: true, token })
    } else {
      res.json({ success: false, message: "Invalid credentials" })
    }

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message })
  }
}

//API to get user profile data
const getProfile = async (req, res) => {
  try {
    const { userId } = req.body
    const userData = await userModel.findById(userId).select('-password')

    res.json({ success: true, userData })

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message })
  }
}

//API to update user profile
const updateProfile = async (req, res) => {
  try {

    const { userId, name, phone, dob, gender, address } = req.body
    const imageFile = req.file;

    if (!name || !phone || !dob || !gender) {
      return res.json({ success: false, message: "Data Missing" })
    }

    await userModel.findByIdAndUpdate(userId, { name, phone, address: JSON.parse(address), dob, gender })

    if (imageFile) {

      const imageUpload = await cloudinary.uploader.upload(imageFile.path, { resource_type: 'image' })
      const imageURL = imageUpload.secure_url

      await userModel.findByIdAndUpdate(userId, { image: imageURL })
    }

    res.json({ success: true, message: "Profile Updated" })

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message })
  }
}

//API to book appointment
const bookAppointment = async (req, res) => {
  try {

    const { userId, docId, slotDate, slotTime } = req.body;

    const docData = await doctorModel.findById(docId).select('-password')

    if (!docData.available) {
      return res.json({ success: false, message: 'Doctor not available' })
    }

    let slots_booked = docData.slots_booked

    //check for availability
    if (slots_booked[slotDate]) {
      if (slots_booked[slotDate].includes(slotTime)) {
        return res.json({ success: false, message: 'Slot not available' })
      } else {
        slots_booked[slotDate].push(slotTime)
      }
    } else {
      slots_booked[slotDate] = []
      slots_booked[slotDate].push(slotTime)
    }

    const userData = await userModel.findById(userId).select('-password')

    delete docData.slots_booked

    const appointmentData = {
      userId,
      docId,
      userData,
      docData,
      amount: docData.fees,
      slotDate,
      slotTime,
      date: Date.now(),
    }

    const newAppointment = new appointmentModel(appointmentData)
    await newAppointment.save()

    //save new slots in docData
    await doctorModel.findByIdAndUpdate(docId, { slots_booked })

    res.json({ success: true, message: "Appointment booked" })

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message })
  }
}

//API to get user appointments for frontend my-appointment
const listAppointment = async (req, res) => {
  try {
    const { userId } = req.body
    const appointments = await appointmentModel.find({ userId })

    res.json({ success: true, appointments })

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message })
  }
}

//API to cancel appointment
const cancelAppointment = async (req, res) => {
  try {

    const { userId, appointmentId } = req.body

    const appointmentData = await appointmentModel.findById(appointmentId)

    //verify appointment user
    if (appointmentData.userId !== userId) {
      return res.json({ success: false, message: "Unauthorized action" })
    }

    await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true })

    //release doctor slot
    const { docId, slotDate, slotTime } = appointmentData

    const doctorData = await doctorModel.findById(docId)

    let slots_booked = doctorData.slots_booked
    slots_booked[slotDate] = slots_booked[slotDate].filter(e => e !== slotTime)

    await doctorModel.findByIdAndUpdate(docId, { slots_booked })

    res.json({ success: true, message: "Appointment cancelled" })

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message })
  }
}

//API to create stripe payment session
const createStripeSession = async (req, res) => {
  try {
    const { appointmentId } = req.body;
    const appointment = await appointmentModel.findById(appointmentId);

    if (!appointment || appointment.cancelled) {
      return res.json({ success: false, message: "Appointment cancelled or not found" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'inr',
          product_data: {
            name: `Doctor Appointment with ${appointment.docData.name}`,
          },
          unit_amount: appointment.amount * 100,
        },
        quantity: 1,
      }],
      success_url: `${process.env.FRONTEND_URL}/my-appointments?payment=success&appointmentId=${appointmentId}`,
      cancel_url: `${process.env.FRONTEND_URL}/my-appointments?payment=cancel`,
      metadata: {
        appointmentId: appointment._id.toString()
      }
    });

    res.json({ success: true, url: session.url });

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};

//API to make payment successful
const markPaymentSuccess = async (req, res) => {
  try {
    const { appointmentId } = req.body;
    await appointmentModel.findByIdAndUpdate(appointmentId, { payment: true });
    res.json({ success: true, message: 'Payment marked as successful' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

export { registerUser, loginUser, getProfile, updateProfile, bookAppointment, listAppointment, cancelAppointment, createStripeSession, markPaymentSuccess}