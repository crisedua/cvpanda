import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

const testimonials = [
  {
    name: "Sarah Johnson",
    role: "Software Engineer",
    company: "Tech Solutions Inc.",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80",
    content: "This platform transformed my job search. The AI-powered CV analysis helped me highlight my achievements more effectively, leading to multiple interview offers.",
    rating: 5
  },
  {
    name: "Michael Chen",
    role: "Product Manager",
    company: "Innovation Labs",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&h=200&q=80",
    content: "The professional development insights were invaluable. I learned exactly what skills I needed to focus on for my career progression.",
    rating: 5
  },
  {
    name: "Emily Rodriguez",
    role: "Marketing Director",
    company: "Global Brands",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&h=200&q=80",
    content: "The CV templates and personalized suggestions helped me stand out in a competitive market. Landed my dream job within weeks!",
    rating: 5
  },
  {
    name: "David Kim",
    role: "Data Scientist",
    company: "Analytics Co",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&h=200&q=80",
    content: "The multilingual support and industry-specific optimization made all the difference in my international job search.",
    rating: 5
  }
];

const Testimonials = () => {
  const swiperRef = useRef(null);

  return (
    <Swiper
      ref={swiperRef}
      modules={[Autoplay, Pagination]}
      spaceBetween={30}
      slidesPerView={1}
      breakpoints={{
        640: {
          slidesPerView: 2,
        },
        1024: {
          slidesPerView: 3,
        },
      }}
      autoplay={{
        delay: 5000,
        disableOnInteraction: false,
      }}
      pagination={{
        clickable: true,
        bulletClass: 'swiper-pagination-bullet !bg-indigo-600 !opacity-100',
        bulletActiveClass: 'swiper-pagination-bullet-active !bg-indigo-600',
      }}
      className="pb-12"
    >
      {testimonials.map((testimonial, index) => (
        <SwiperSlide key={index}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.2 }}
            className="bg-white rounded-xl shadow-lg p-6 h-full flex flex-col"
          >
            <div className="flex-1">
              <Quote className="h-8 w-8 text-indigo-500 mb-4" />
              <p className="text-gray-600 italic mb-4">
                "{testimonial.content}"
              </p>
              <div className="flex items-center mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star
                    key={i}
                    className="h-5 w-5 text-yellow-400 fill-current"
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center mt-4">
              <img
                src={testimonial.image}
                alt={testimonial.name}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div className="ml-4">
                <h4 className="text-sm font-semibold text-gray-900">
                  {testimonial.name}
                </h4>
                <p className="text-sm text-gray-500">
                  {testimonial.role} at {testimonial.company}
                </p>
              </div>
            </div>
          </motion.div>
        </SwiperSlide>
      ))}
    </Swiper>
  );
};

export default Testimonials;