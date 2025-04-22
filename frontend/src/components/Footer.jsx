import React from 'react'
import { assets } from '../assets/assets'
import { NavLink } from 'react-router-dom'

const Footer = () => {
  return (
    <div className='md:mx-10'>
      <div className='flex flex-col sm:grid grid-cols-[3fr_1fr_1fr] gap-14 my-8 mt-28 text-sm'>
        {/* left */}
        <div>
          <img className=' w-40 mb-5' src={assets.logo} alt="" />
          <p className='w-full md:w-2/3 text-gray-600 leading-6 '>DocBooker simplifies doctor appointments by connecting patients with trusted healthcare professionals. Manage your consultations seamlessly with our secure and user-friendly platform. Book your appointment today for hassle-free healthcare!</p>
        </div>

        {/* center */}
        <div>
          <p className='text-xl font-medium mb-5'>DOCBOOKER</p>  
          <ul className='flex flex-col gap-2 text-gray-600'>
            <NavLink to='/'>
              <li>Home</li>
            </NavLink>
            <NavLink to='/about'>
              <li>About us</li>
            </NavLink>
            <NavLink to='/contact'>
              <li>Contact us</li>
            </NavLink>
            
            <li>Privacy policy</li>
          </ul>
        </div>

        {/* right */}
        <div>
          <p className='text-xl font-medium mb-5'>GET IN TOUCH</p>
          <ul className='flex flex-col gap-2 text-gray-600'>
            <li>+91 987654321</li>
            <li>docbooker@gmail.com</li>
          </ul>
        </div>

      </div>
      {/* copyright */}
      <div>
        <hr />
        <p className='py-5 text-sm text-center '>Copyright 2025© DocBooker - All right reserved</p>
      </div>
    </div>
  )
}

export default Footer